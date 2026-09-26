# ESP32: hardware, maquete e firmware

## ⚠️ Segurança elétrica (leia primeiro)

- **Nunca** ligue o ESP32 (ou qualquer Arduino) diretamente à rede elétrica de 127/220 V.
- Para a **maquete acadêmica**, use **baixa tensão**: fonte 12 V DC alimentando LEDs,
  mini ventoinhas etc. É seguro de montar e de apresentar.
- Medir a rede elétrica de verdade exige sensores **isolados** (alicate SCT-013 não invasivo,
  ou módulos prontos como PZEM-004T), caixa fechada, fusíveis/disjuntor e acompanhamento de
  um profissional habilitado.

## Opção recomendada — maquete 12 V com INA219

Cada cômodo da maquete é um circuito de 12 V com sua carga (LEDs), e cada circuito passa por
um módulo **INA219**, que mede **tensão, corrente e potência** (dados realmente medidos).

### Materiais (4 cômodos)

| Item | Qtd. |
|---|---|
| ESP32 DevKit V1 (38 pinos) | 1 |
| Módulo INA219 (I2C) | 4 |
| Fonte 12 V DC, 2 A | 1 |
| Regulador step-down (12 V → 5 V) ou alimentação USB para o ESP32 | 1 |
| Fitas/LEDs 12 V (uma carga por cômodo) + interruptores | 4 |
| Protoboard, jumpers, bornes | — |

### Endereços I2C

Os 4 INA219 ficam no mesmo barramento I2C, cada um com um endereço (solde os jumpers A0/A1):

| Canal (site) | Cômodo | A1 | A0 | Endereço |
|---|---|---|---|---|
| Sensor 01 | Sala | — | — | `0x40` |
| Sensor 02 | Cozinha | — | ✔ | `0x41` |
| Sensor 03 | Quarto | ✔ | — | `0x44` |
| Sensor 04 | Banheiro | ✔ | ✔ | `0x45` |

### Ligações

```
ESP32 3V3 ──► VCC de todos os INA219
ESP32 GND ──► GND de todos os INA219  ── GND da fonte 12 V (terra comum!)
ESP32 GPIO21 (SDA) ──► SDA de todos os INA219
ESP32 GPIO22 (SCL) ──► SCL de todos os INA219

Para cada cômodo:
  +12 V da fonte ──► VIN+ do INA219 ──► VIN− do INA219 ──► interruptor ──► carga (+)
  carga (−) ──► GND da fonte
```

O INA219 fica **em série** no positivo de cada circuito. Módulos comuns vêm com shunt de
0,1 Ω (até ~3,2 A); o firmware usa a calibração 32 V / 1 A, ideal para LEDs.

## Opção AC — SCT-013 (alicate de corrente)

- O SCT-013-030 abraça **um** dos fios da fase, sem contato elétrico.
- Precisa de um pequeno circuito de polarização (2 resistores de 10 kΩ + capacitor de 10 µF)
  para deslocar o sinal para o meio da faixa do ADC.
- Use somente pinos **ADC1**: 32, 33, 34, 35, 36 ou 39 (o ADC2 não funciona com Wi-Fi ligado).
- Como o SCT-013 mede só a corrente, a potência é **estimada** com a tensão nominal
  (`MAINS_VOLTAGE`), sem fator de potência — deixe isso claro na apresentação.

## Configurar e gravar o firmware

1. Instale a **Arduino IDE 2**.
2. **Arquivo → Preferências → URLs adicionais**:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. **Gerenciador de Placas** → instale **esp32 by Espressif**.
4. **Gerenciador de Bibliotecas** → instale **ArduinoJson** (7.x) e **Adafruit INA219**.
5. No site, vá em **Dispositivos → Novo dispositivo** e copie o bloco com
   `DEVICE_ID`, `DEVICE_KEY` e `API_URL`.
6. Na pasta `firmware/esp32_monitor_energia/`, copie `config.example.h` para **`config.h`** e preencha:
   Wi-Fi (rede **2,4 GHz**), os três valores do site e `SENSOR_MODE`.
7. Abra `esp32_monitor_energia.ino`, selecione a placa **ESP32 Dev Module** e a porta COM, e clique em **Carregar**.
8. Abra o **Monitor Serial** (115200 baud). Você deve ver:

   ```
   [INA219] canal 1 (0x40): OK
   [Wi-Fi] conectado! IP: 192.168.0.23  sinal: -58 dBm
   [API] POST 201  {"deviceId":"ESP32-001",...}
   ```

   Em segundos o dispositivo aparece como **🟢 Online** no site e o painel sai do modo
   demonstração.

### Funcionamento do firmware

- Lê os sensores a cada **1 s** e acumula; a cada **5 s** envia a **média** do período
  (melhora o cálculo de energia).
- Horário sincronizado por NTP (UTC). Sem NTP, o servidor usa o próprio horário.
- Se o envio falhar, mantém a média acumulada e tenta de novo; reconecta o Wi-Fi sozinho.
- LED azul: piscando = conectando; aceso = último envio OK; apagado = erro.
- `SENSOR_SIMULADO` permite testar Wi-Fi/API sem sensores (os valores **não** são reais).

### Testar na rede local (sem publicar)

Rode `npm run dev:api` e, em outro terminal, `npx vite --host` no computador. Depois use no `config.h`:
`#define API_URL "http://IP_DO_COMPUTADOR:5173/api/energy/readings"`.
