/*
 * =====================================================================
 *  Energia Inteligente — firmware do ESP32
 *  Monitoramento do consumo de energia por cômodo via Wi-Fi
 * =====================================================================
 *
 *  Fluxo:
 *    sensores → ESP32 (lê a cada 1 s e faz a média) → Wi-Fi →
 *    POST /api/energy/readings (a cada 5 s) → banco → dashboard
 *
 *  Bibliotecas (Arduino IDE → Gerenciador de Bibliotecas):
 *    • ArduinoJson (Benoit Blanchon) — versão 7.x
 *    • Adafruit INA219              — somente se SENSOR_MODE = SENSOR_INA219
 *
 *  Placa: "ESP32 Dev Module" (pacote esp32 by Espressif, 2.x ou 3.x)
 *
 *  ⚠️ SEGURANÇA ELÉTRICA: nunca ligue o ESP32 diretamente à rede elétrica.
 *  Na maquete, use circuitos de BAIXA TENSÃO (ex.: 12 V DC com LEDs) e
 *  sensores INA219. Medição em 127/220 V exige sensores isolados (SCT-013
 *  não invasivo ou módulos como PZEM-004T), caixa fechada, proteção e
 *  acompanhamento de um profissional habilitado.
 * =====================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>

#include "config.h"  // copie config.example.h → config.h e preencha

#if SENSOR_MODE == SENSOR_INA219
#include <Wire.h>
#include <Adafruit_INA219.h>
#endif

#define FIRMWARE_VERSION "1.0.0"

// Certificado raiz (usado somente se USE_INSECURE_TLS = 0)
static const char *ROOT_CA = R"EOF(
-----BEGIN CERTIFICATE-----
COLE_AQUI_O_CERTIFICADO_RAIZ_DO_SEU_DOMINIO
-----END CERTIFICATE-----
)EOF";

// ---------------------------------------------------------------------
// Estrutura de uma leitura instantânea
// ---------------------------------------------------------------------
struct Measurement {
  float powerW;    // potência (W)
  float voltageV;  // tensão (V)  — NAN se o sensor não mede
  float currentA;  // corrente (A)
};

// Acumuladores para a média entre dois envios
static double sumPower[NUM_SENSORS];
static double sumVoltage[NUM_SENSORS];
static double sumCurrent[NUM_SENSORS];
static uint16_t voltageSamples[NUM_SENSORS];
static uint16_t samples = 0;

static unsigned long lastSample = 0;
static unsigned long lastSend = 0;
static unsigned long backoffUntil = 0;

// =====================================================================
//  SENSORES
// =====================================================================
#if SENSOR_MODE == SENSOR_INA219
static const uint8_t inaAddr[] = INA219_ADDRESSES;
static Adafruit_INA219 *ina[NUM_SENSORS];
static bool inaOk[NUM_SENSORS];

void sensorsBegin() {
  Wire.begin(I2C_SDA, I2C_SCL);
  for (int i = 0; i < NUM_SENSORS; i++) {
    ina[i] = new Adafruit_INA219(inaAddr[i]);
    inaOk[i] = ina[i]->begin();
    // Faixa 32 V / 1 A: melhor resolução para LEDs/cargas pequenas da maquete.
    // Para até 2 A use setCalibration_32V_2A().
    if (inaOk[i]) ina[i]->setCalibration_32V_1A();
    Serial.printf("[INA219] canal %d (0x%02X): %s\n", i + 1, inaAddr[i], inaOk[i] ? "OK" : "NÃO ENCONTRADO");
  }
}

Measurement readSensor(int i) {
  if (!inaOk[i]) return {NAN, NAN, NAN};
  float busV = ina[i]->getBusVoltage_V();
  float shuntmV = ina[i]->getShuntVoltage_mV();
  float currentA = ina[i]->getCurrent_mA() / 1000.0f;
  float loadV = busV + shuntmV / 1000.0f;
  if (currentA < 0) currentA = 0;
  return {loadV * currentA, loadV, currentA};
}

#elif SENSOR_MODE == SENSOR_SCT013
static const uint8_t sctPins[] = SCT013_PINS;

void sensorsBegin() {
  analogReadResolution(12);
  for (int i = 0; i < NUM_SENSORS; i++) {
    analogSetPinAttenuation(sctPins[i], ADC_11db);  // faixa de ~0 a 3,1 V
  }
  Serial.println("[SCT-013] pronto (potência = Irms × tensão nominal)");
}

// Corrente eficaz (RMS): amostra ~12 ciclos de 60 Hz e remove o nível DC do divisor
float readIrms(uint8_t pin) {
  const int N = 1200;
  static int32_t buf[N];
  int64_t sum = 0;
  for (int k = 0; k < N; k++) {
    buf[k] = analogReadMilliVolts(pin);
    sum += buf[k];
    delayMicroseconds(150);
  }
  double mean = (double)sum / N;
  double sq = 0;
  for (int k = 0; k < N; k++) {
    double d = buf[k] - mean;
    sq += d * d;
  }
  double vrms = sqrt(sq / N) / 1000.0;  // V
  double irms = vrms * SCT013_AMPS_PER_V;
  return irms < SCT013_NOISE_A ? 0 : irms;
}

Measurement readSensor(int i) {
  float irms = readIrms(sctPins[i]);
  // Sem medir tensão, a potência é APARENTE e estimada com a tensão nominal
  return {irms * (float)MAINS_VOLTAGE, (float)MAINS_VOLTAGE, irms};
}

#else  // SENSOR_SIMULADO
void sensorsBegin() {
  randomSeed(esp_random());
  Serial.println("[SIMULADO] gerando valores de teste — NÃO são medições reais");
}

Measurement readSensor(int i) {
  static const float base[] = {350, 800, 120, 80, 60, 200, 150, 100};
  float p = base[i % 8] * (0.85f + random(0, 300) / 1000.0f);
  return {p, 127.0f, p / 127.0f};
}
#endif

// =====================================================================
//  Wi-Fi e horário (NTP)
// =====================================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[Wi-Fi] conectando em \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
    delay(300);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[Wi-Fi] conectado! IP: %s  sinal: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    digitalWrite(STATUS_LED, HIGH);
  } else {
    Serial.println("\n[Wi-Fi] falhou — tentando novamente depois");
    digitalWrite(STATUS_LED, LOW);
  }
}

bool clockSynced() {
  time_t now = time(nullptr);
  return now > 1700000000;  // depois de 2023 → NTP já sincronizou
}

// Horário atual em UTC no formato ISO 8601 (ex.: 2026-09-26T14:00:00Z)
bool isoTimestamp(char *out, size_t len) {
  if (!clockSynced()) return false;
  time_t now = time(nullptr);
  struct tm t;
  gmtime_r(&now, &t);
  strftime(out, len, "%Y-%m-%dT%H:%M:%SZ", &t);
  return true;
}

// =====================================================================
//  Envio para a API
// =====================================================================
void resetAccumulators() {
  for (int i = 0; i < NUM_SENSORS; i++) {
    sumPower[i] = sumVoltage[i] = sumCurrent[i] = 0;
    voltageSamples[i] = 0;
  }
  samples = 0;
}

void sampleSensors() {
  for (int i = 0; i < NUM_SENSORS; i++) {
    Measurement m = readSensor(i);
    if (isnan(m.powerW)) continue;
    sumPower[i] += m.powerW;
    sumCurrent[i] += m.currentA;
    if (!isnan(m.voltageV)) {
      sumVoltage[i] += m.voltageV;
      voltageSamples[i]++;
    }
  }
  samples++;
}

bool sendReadings() {
  if (samples == 0) return false;

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["firmware"] = FIRMWARE_VERSION;
  char ts[25];
  if (isoTimestamp(ts, sizeof(ts))) doc["timestamp"] = ts;

  JsonArray arr = doc["readings"].to<JsonArray>();
  for (int i = 0; i < NUM_SENSORS; i++) {
#if SENSOR_MODE == SENSOR_INA219
    if (!inaOk[i]) continue;
#endif
    JsonObject r = arr.add<JsonObject>();
    r["sensor"] = i + 1;
    r["power"] = serialized(String(sumPower[i] / samples, 2));
    r["current"] = serialized(String(sumCurrent[i] / samples, 4));
    if (voltageSamples[i]) r["voltage"] = serialized(String(sumVoltage[i] / voltageSamples[i], 2));
  }
  if (arr.size() == 0) {
    Serial.println("[API] nenhum sensor respondeu — nada a enviar");
    return false;
  }

  String body;
  serializeJson(doc, body);

  WiFiClientSecure secure;
  WiFiClient plain;
  HTTPClient http;
  bool https = String(API_URL).startsWith("https");
  if (https) {
#if USE_INSECURE_TLS
    secure.setInsecure();
#else
    secure.setCACert(ROOT_CA);
#endif
    http.begin(secure, API_URL);
  } else {
    http.begin(plain, API_URL);  // ex.: teste na rede local (http://192.168.x.x:5173)
  }
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int code = http.POST(body);
  String resp = http.getString();
  http.end();

  Serial.printf("[API] POST %d  %s\n", code, body.c_str());
  if (code == 201) return true;

  if (code == 401) Serial.println("[API] 401: DEVICE_ID ou DEVICE_KEY incorretos (gere uma nova chave no site).");
  else if (code == 429) backoffUntil = millis() + 5000;
  else if (code < 0) Serial.printf("[API] erro de conexão: %s\n", http.errorToString(code).c_str());
  else Serial.printf("[API] resposta: %s\n", resp.c_str());
  return false;
}

// =====================================================================
void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(STATUS_LED, OUTPUT);
  Serial.println("\n=== Energia Inteligente — ESP32 v" FIRMWARE_VERSION " ===");
  Serial.printf("Dispositivo: %s  |  sensores: %d\n", DEVICE_ID, NUM_SENSORS);

  sensorsBegin();
  connectWiFi();
  configTime(0, 0, "pool.ntp.org", "time.google.com");  // UTC
  resetAccumulators();
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (now - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = now;
    sampleSensors();
  }

  if (now - lastSend >= SEND_INTERVAL_MS && now >= backoffUntil && WiFi.status() == WL_CONNECTED) {
    lastSend = now;
    if (sendReadings()) {
      resetAccumulators();
      digitalWrite(STATUS_LED, HIGH);
    } else {
      // Mantém as somas: o próximo envio leva a média do período inteiro
      digitalWrite(STATUS_LED, LOW);
      if (samples > 600) resetAccumulators();  // evita acumular indefinidamente
    }
  }
  delay(10);
}
