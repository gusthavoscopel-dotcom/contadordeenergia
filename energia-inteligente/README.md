# ⚡ Energia Inteligente

Sistema inteligente de monitoramento do consumo de energia elétrica **por cômodo**, com
**ESP32 + Wi-Fi + plataforma web**. Projeto acadêmico, pronto para receber dados reais dos sensores.

- **Frontend:** React + Vite + Tailwind + Recharts
- **Backend:** funções serverless na Vercel (`/api`)
- **Banco, autenticação e tempo real:** Supabase (PostgreSQL + Auth + Realtime + pg_cron)
- **Hardware:** ESP32 com INA219 (maquete 12 V) ou SCT-013 (AC)

## O que o sistema faz

Cadastro → código de 6 dígitos por e-mail → conta verificada → login → assistente de
configuração (residência, cômodos, tarifa) → cadastro do ESP32 (ID + chave secreta) →
vínculo sensor → cômodo → ESP32 envia leituras por Wi-Fi → API valida e grava →
dashboard atualiza sozinho com **W, kWh e R$** → histórico, gráficos e alertas.

| Página | Destaques |
|---|---|
| Landing | apresentação + ilustração da casa conectada |
| Cadastro / Verificação / Login / Recuperar senha | código por e-mail, "Lembrar de mim", validação de senha |
| Dashboard | consumo atual, hoje, mês, custos, **previsão do mês (estimativa)**, cards por cômodo, gráficos, status do ESP32, alertas |
| Cômodos | adicionar, editar, excluir, limite de potência por cômodo |
| Dispositivos | cadastrar ESP32, chave secreta, **Sensor 01 → Sala**, status online/offline |
| Histórico | Hoje, 7 dias, 30 dias, este mês, mês anterior, personalizado, por cômodo, exportar CSV |
| Gráficos | consumo por cômodo, ao longo do dia, mensal |
| Alertas | potência acima do limite, consumo acima da média, dispositivo offline |
| Configurações | residência, tarifa R$/kWh, limites, notificações, modo demonstração |
| Perfil | alterar nome, senha, e-mail; excluir conta |

Os valores são marcados como **Medido**, **Calculado**, **Estimado** ou **Simulado**.
Sem ESP32 enviando dados, o painel entra no **🟡 Modo demonstração** (claramente sinalizado)
e volta sozinho para os dados reais quando o dispositivo conecta.

## Início rápido

```bash
npm install
cp .env.example .env     # preencha com as chaves do Supabase
npm run dev              # http://localhost:5173
```

Antes, crie o projeto no Supabase e rode `supabase/schema.sql` e `supabase/cron.sql`.

## Documentação

1. **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**: arquitetura, pastas, comunicação, modelo do banco, endpoints e JSON do ESP32
2. **[docs/CONFIGURACAO.md](docs/CONFIGURACAO.md)**: passo a passo do Supabase, do envio de e-mail (SMTP) e do deploy na Vercel
3. **[docs/ESP32.md](docs/ESP32.md)**: montagem da maquete, ligações, gravação do firmware

## Scripts

| Comando | Faz |
|---|---|
| `npm run dev` | site (5173) + API local (3001) |
| `npm run build` | build de produção |
| `npm test` | testes da validação da API |
| `npm run simulate` | simula um ESP32 enviando leituras (só para testes) |

## Licença

Uso acadêmico.
