# Arquitetura do sistema

## 1. Visão geral

```
┌────────────────────────────┐        HTTPS (Wi-Fi)        ┌──────────────────────────────┐
│  MAQUETE                   │  POST /api/energy/readings  │  VERCEL                      │
│  Sensor 1 → Sala           │  X-Device-Key: ek_...       │                              │
│  Sensor 2 → Cozinha   ESP32├────────────────────────────►│  Funções serverless (/api)   │
│  Sensor 3 → Quarto         │                             │  • valida o JSON             │
│  Sensor 4 → Banheiro       │                             │  • autentica o dispositivo   │
└────────────────────────────┘                             │  • chama ingest_readings()   │
                                                           └──────────────┬───────────────┘
                                                                          │ service role
                                                                          ▼
┌────────────────────────────┐  Supabase JS (anon key +    ┌──────────────────────────────┐
│  NAVEGADOR                 │  token do usuário)          │  SUPABASE                    │
│  React + Vite (Vercel)     │◄───────────────────────────►│  • Auth (cadastro, código    │
│  Dashboard, gráficos,      │  REST / RPC                 │    por e-mail, bcrypt)       │
│  histórico, alertas        │                             │  • PostgreSQL + RLS          │
│                            │◄────────────────────────────┤  • Realtime (WebSocket)      │
└────────────────────────────┘  novas leituras em tempo    │  • pg_cron (offline/consumo) │
                                real                       └──────────────────────────────┘
```

### Por que essa stack (e não Express)

O enunciado sugere Node.js + Express. Como o deploy é na **Vercel**, um servidor Express
rodando o tempo todo não é o modelo ideal: a Vercel executa **funções serverless** que sobem
sob demanda. Por isso o backend foi escrito como funções em `/api` (Node.js puro), que fazem
exatamente o papel de uma API REST e são publicadas junto com o frontend, no mesmo projeto,
sem servidor para manter.

Outras decisões:

| Requisito | Solução |
|---|---|
| Cadastro, código por e-mail, login, recuperação | **Supabase Auth** (OTP de 6 dígitos por e-mail) |
| Nunca armazenar senha em texto puro | Supabase Auth guarda **hash bcrypt** em `auth.users` |
| Usuário A nunca ver dados do usuário B | **Row Level Security** em todas as tabelas |
| Tempo real | **Supabase Realtime** (`postgres_changes`) |
| Cálculo de kWh confiável | Feito **no banco**, dentro de `ingest_readings()` |
| Alertas de offline e consumo acima da média | **pg_cron** no próprio Supabase (1 min / 5 min) |
| Segredos | Variáveis de ambiente (Vercel e `.env`) |

## 2. Estrutura de pastas

```
energia-inteligente/
├── api/                          ← BACKEND (funções serverless da Vercel)
│   ├── _lib/                     ← código compartilhado (não vira rota)
│   │   ├── http.js               ← JSON, CORS, rate limit, erros
│   │   ├── validate.js           ← validação do JSON do ESP32
│   │   ├── deviceAuth.js         ← chave do dispositivo (SHA-256, tempo constante)
│   │   └── supabaseAdmin.js      ← cliente com service role (só no servidor)
│   ├── energy/readings.js        ← POST /api/energy/readings  (ESP32)
│   ├── account/delete.js         ← POST /api/account/delete   (excluir conta)
│   └── health.js                 ← GET  /api/health
├── src/                          ← FRONTEND (React + Vite + Tailwind)
│   ├── pages/                    ← Landing, auth/*, app/* (dashboard etc.)
│   ├── components/               ← UI, gráficos, layout com menu lateral
│   ├── context/                  ← Auth, Home (dados + realtime + modo demo), Toast
│   └── lib/                      ← supabase, cálculos de energia, modo demo, formatação
├── supabase/
│   ├── schema.sql                ← tabelas, RLS, funções, realtime
│   ├── cron.sql                  ← rotinas periódicas (offline / consumo elevado)
│   └── email-templates/          ← e-mails com o código de 6 dígitos
├── firmware/esp32_monitor_energia/
│   ├── esp32_monitor_energia.ino ← firmware (INA219 / SCT-013 / simulado)
│   └── config.example.h          ← Wi-Fi, DEVICE_ID, DEVICE_KEY, API_URL
├── scripts/
│   ├── dev-api.js                ← roda as funções /api localmente
│   └── simulate-esp32.js         ← simula um ESP32 enviando dados
├── tests/                        ← testes da validação (node --test)
├── vercel.json                   ← build + rotas do SPA
└── .env.example
```

## 3. Como as partes se comunicam

1. **Navegador ↔ Supabase (direto).** O frontend usa `@supabase/supabase-js` com a **anon key**
   (pública). Depois do login, cada requisição leva o token do usuário e o **RLS** do Postgres
   filtra tudo por `user_id = auth.uid()`. Mesmo alguém chamando a API do Supabase na mão com a
   anon key não consegue ler dados de outra pessoa.
2. **ESP32 → Vercel.** O ESP32 não fala com o banco. Ele faz `POST /api/energy/readings` com o
   header `X-Device-Key`. A função compara o SHA-256 da chave com o hash guardado, valida o
   JSON e chama `ingest_readings()` usando a **service role key** (que só existe no servidor).
3. **Supabase → Navegador (tempo real).** Cada leitura inserida gera um evento no Realtime; o
   dashboard está inscrito em `readings`, `devices` e `alerts` do próprio usuário e atualiza
   sozinho. Os agregados (kWh de hoje/mês) também são recarregados a cada 60 s.
4. **pg_cron.** A cada minuto marca dispositivos sem dados como offline (e cria alerta); a cada
   5 minutos compara o consumo recente de cada cômodo com a média dos últimos 7 dias.

## 4. Modelo do banco de dados

```
auth.users (Supabase)                 ← e-mail, senha (hash bcrypt), e-mail confirmado
   │ 1:1
profiles (id, nome, email, email_verificado, created_at)
   │ 1:1
residences (id, user_id, nome, tarifa_kwh, power_limit_w, offline_after_s,
            notify_high_consumption, notify_offline, notify_high_power, demo_mode)
   ├── 1:N rooms   (id, residence_id, user_id, nome, icone, power_limit_w)
   └── 1:N devices (id, residence_id, user_id, device_id ÚNICO, nome, api_key_hash,
                    status, last_seen, firmware)
              └── 1:N sensors (id, device_id, user_id, room_id → rooms, canal 1..32, nome)
                         └── 1:N readings (id, sensor_id, room_id, user_id,
                                           power_w, voltage, current,   ← MEDIDO
                                           energy_kwh,                  ← CALCULADO
                                           measured_at)
alerts (id, user_id, room_id, device_id, tipo, mensagem, valor, limite, visualizado, created_at)
```

Mapeamento com o enunciado: a tabela **Usuários** (com `senha_hash`) é o `auth.users` do
Supabase + `profiles`; `Dispositivos.status` é atualizado pela API (online) e pelo cron (offline);
`Leituras.timestamp` é `measured_at`.

### Funções SQL

| Função | Quem chama | O que faz |
|---|---|---|
| `ingest_readings(device, items, ts)` | API (service role) | grava leituras, calcula kWh, alerta de potência, atualiza `last_seen` |
| `latest_readings(janela_s)` | frontend | última leitura de cada sensor (potência "agora") |
| `energy_by_room(de, até)` | frontend | kWh por cômodo no período |
| `energy_by_bucket(de, até, 'hour'/'day'/'month', fuso, cômodo)` | frontend | séries dos gráficos e do histórico |
| `check_offline_devices()` | pg_cron (1 min) | status offline + alerta |
| `check_consumption_alerts()` | pg_cron (5 min) | alerta de consumo ≥ 30% acima da média |

### Cálculo da energia

```
energia (kWh) = potência média (W) × tempo (h) / 1000
potência média = (potência anterior + potência atual) / 2        ← regra do trapézio
tempo          = intervalo desde a leitura anterior do mesmo sensor (máx. 60 s)
custo (R$)     = energia (kWh) × tarifa (R$/kWh)
```

Exemplo do enunciado: 500 W × 2 h = 1000 Wh = 1 kWh → 1 × R$ 0,95 = **R$ 0,95**.
O limite de 60 s evita "inventar" consumo quando o ESP32 fica desligado.

## 5. Endpoints da API

| Método | Rota | Autenticação | Uso |
|---|---|---|---|
| `POST` | `/api/energy/readings` | `X-Device-Key` | ESP32 envia leituras |
| `POST` | `/api/account/delete` | `Authorization: Bearer <token do usuário>` | excluir conta (`{"confirm":"EXCLUIR"}`) |
| `GET`  | `/api/health` | — | verificar se a API está no ar |

Todo o resto (cômodos, dispositivos, tarifa, histórico, alertas) é feito pelo frontend
diretamente no Supabase, protegido pelo RLS.

### Respostas de `/api/energy/readings`

| HTTP | Significado |
|---|---|
| `201` | gravado. Corpo: `{ ok, inserted, alerts, unmappedSensors, measuredAt, clockAdjusted }` |
| `400` / `422` | JSON inválido ou fora dos limites (mensagem explica o campo) |
| `401` | dispositivo ou chave inválidos |
| `405` | método diferente de POST |
| `413` | corpo maior que 16 KB |
| `429` | mais de 1 envio por segundo do mesmo ESP32 (ou abuso por IP) |

## 6. Formato JSON do ESP32

**Lote (recomendado — um POST por ciclo com todos os sensores):**

```json
{
  "deviceId": "ESP32-001",
  "firmware": "1.0.0",
  "timestamp": "2026-09-26T14:00:00Z",
  "readings": [
    { "sensor": 1, "power": 350.5, "voltage": 127.0, "current": 2.76 },
    { "sensor": 2, "power": 780.0, "voltage": 127.0, "current": 6.14 }
  ]
}
```

**Leitura única (formato do enunciado também é aceito):**

```json
{ "deviceId": "ESP32-001", "sensor": 1, "power": 350.5, "voltage": 127, "current": 2.76 }
```

- `sensor` é o **canal** (1 a 32). O vínculo *canal → cômodo* é feito no site
  (Dispositivos). Por isso o ESP32 envia `sensor`, e não `roomId`: dá para trocar um sensor
  de cômodo sem regravar o firmware.
- `timestamp` precisa ter fuso (`Z` ou `-03:00`). Sem fuso, ou com mais de 10 min de diferença
  do servidor, o servidor usa o próprio horário (`clockAdjusted: true`).
- Limites: potência 0–100 000 W, tensão 0–500 V, corrente 0–200 A, até 32 leituras por envio.
- Canal desconhecido é criado automaticamente como "Sensor NN" sem cômodo, para você vincular.

## 7. Segurança implementada

- Senhas: hash bcrypt (Supabase Auth); mínimo de 8 caracteres com letras e números.
- Conta só entra depois de confirmar o código enviado por e-mail.
- RLS em todas as tabelas + `WITH CHECK` impedindo vincular sensor/cômodo de outra pessoa.
- Permissões por coluna: o usuário não consegue alterar `status`/`last_seen` do dispositivo,
  nem inserir leituras ou alertas falsos.
- Chave do dispositivo: 192 bits aleatórios, só o SHA-256 é salvo, comparação em tempo constante,
  mesma resposta para "dispositivo não existe" e "chave errada".
- Rate limiting: 1 envio/s por dispositivo (no banco) + limite por IP nas funções; o Supabase
  Auth tem limites próprios para login e envio de e-mail.
- Validação de todos os campos recebidos do ESP32; corpo limitado a 16 KB.
- CORS restrito às origens de `ALLOWED_ORIGINS`.
- `SUPABASE_SERVICE_ROLE_KEY` nunca vai para o navegador nem para o ESP32.
- Cabeçalhos de segurança (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) no `vercel.json`.

## 8. Dados medidos × calculados × estimados

A interface marca cada número com um selo:

- **MEDIDO** — potência, tensão, corrente vindas do sensor.
- **CALCULADO** — kWh e R$ calculados pelo sistema.
- **ESTIMADO** — previsão do mês (extrapolação do consumo até agora; não é a conta oficial).
- **SIMULADO** — tudo no modo demonstração, com a faixa "🟡 MODO DEMONSTRAÇÃO" no topo.

No modo automático, a demonstração só aparece enquanto nenhum ESP32 enviou dados na última
hora. Assim que chegam dados reais, o painel passa sozinho a mostrá-los.
