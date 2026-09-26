// =====================================================================
// CONFIGURAÇÃO DO ESP32 — copie este arquivo para "config.h" e preencha.
// O config.h NÃO deve ir para o GitHub (já está no .gitignore).
// =====================================================================
#pragma once

// ---------- Wi-Fi (rede 2,4 GHz; o ESP32 não conecta em 5 GHz) ----------
#define WIFI_SSID      "NOME_DA_SUA_REDE"
#define WIFI_PASSWORD  "SENHA_DA_SUA_REDE"

// ---------- Dispositivo (copie da tela Dispositivos do site) ----------
#define DEVICE_ID   "ESP32-001"
#define DEVICE_KEY  "ek_cole_aqui_a_chave_gerada_no_site"
#define API_URL     "https://SEU-PROJETO.vercel.app/api/energy/readings"

// ---------- Tipo de sensor ----------
//   SENSOR_INA219    → maquete em BAIXA TENSÃO (12 V DC). Recomendado e seguro.
//   SENSOR_SCT013    → sensor de corrente NÃO invasivo (alicate) para AC.
//                      Mede só corrente; a potência é estimada com a tensão nominal.
//   SENSOR_SIMULADO  → sem sensores, gera valores de teste (apenas para testar
//                      a comunicação; não apresente como medição real).
#define SENSOR_INA219   1
#define SENSOR_SCT013   2
#define SENSOR_SIMULADO 3
#define SENSOR_MODE     SENSOR_INA219

// Quantos sensores (canais). Canal 1 = "Sensor 01" no site, e assim por diante.
#define NUM_SENSORS 4

// INA219: endereço I2C de cada módulo (jumpers A0/A1 da placa)
//   0x40 (padrão), 0x41 (A0), 0x44 (A1), 0x45 (A0+A1)
#define INA219_ADDRESSES { 0x40, 0x41, 0x44, 0x45 }
#define I2C_SDA 21
#define I2C_SCL 22

// SCT-013: pinos ADC1 (use SOMENTE 32, 33, 34, 35, 36 ou 39 — o ADC2 não
// funciona junto com o Wi-Fi)
#define SCT013_PINS        { 36, 39, 34, 35 }
#define SCT013_AMPS_PER_V  30.0   // SCT-013-030: 30 A ↔ 1 V de saída
#define MAINS_VOLTAGE      127.0  // tensão nominal da rede (127 ou 220)
#define SCT013_NOISE_A     0.08   // abaixo disso considera 0 A (ruído)

// ---------- Tempos ----------
#define SAMPLE_INTERVAL_MS  1000   // lê os sensores a cada 1 s
#define SEND_INTERVAL_MS    5000   // envia a média para a API a cada 5 s

// ---------- HTTPS ----------
// 1 = não valida o certificado do servidor (mais simples para o protótipo).
// Para produção, use 0 e preencha ROOT_CA no .ino com o certificado raiz.
#define USE_INSECURE_TLS 1

// LED de status (LED azul da placa na maioria dos DevKits)
#define STATUS_LED 2
