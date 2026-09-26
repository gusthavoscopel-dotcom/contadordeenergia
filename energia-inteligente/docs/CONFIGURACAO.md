# Configuração: Supabase, e-mail e Vercel

Siga na ordem. Tempo estimado: 20–30 min.

---

## 1. Supabase (banco + autenticação)

1. Crie uma conta em <https://supabase.com> → **New project**.
   - Região: **South America (São Paulo)**.
   - Guarde a senha do banco (não é usada pelo sistema, mas o Supabase pede).
2. **Criar as tabelas:** menu **SQL Editor → New query** → cole todo o conteúdo de
   `supabase/schema.sql` → **Run**. Deve terminar com "Success. No rows returned".
3. **Rotinas periódicas:** nova query com `supabase/cron.sql` → **Run**.
   Se der erro de permissão no `pg_cron`: **Database → Extensions → pg_cron → Enable** e rode de novo.
4. **Chaves:** **Project Settings → API** (ou **API Keys**):
   - `Project URL` → `VITE_SUPABASE_URL` e `SUPABASE_URL`
   - `anon` / `publishable` key → `VITE_SUPABASE_ANON_KEY` (pública, vai para o navegador)
   - `service_role` / `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (**secreta**, só no servidor)
5. **Realtime:** o `schema.sql` já adiciona `readings`, `alerts` e `devices` à publicação
   `supabase_realtime`. Para conferir: **Database → Publications → supabase_realtime**.

### 1.1 Autenticação por código

Menu **Authentication**:

1. **Sign In / Providers → Email**
   - ✅ *Enable Email provider*
   - ✅ *Confirm email* (obrigatório — é isso que exige o código)
   - *Minimum password length*: **8**
   - *Email OTP Length*: **6** · *Email OTP Expiration*: **3600** (1 hora)
2. **URL Configuration → Site URL**: a URL do site na Vercel (ex.: `https://energia-inteligente.vercel.app`).
   Em *Redirect URLs* adicione também `http://localhost:5173`.
3. **Emails → Templates** — troque os três modelos abaixo para mostrar o **código**
   (`{{ .Token }}`) em vez de um link. Os HTMLs prontos estão em `supabase/email-templates/`:

   | Template | Assunto sugerido | Arquivo |
   |---|---|---|
   | Confirm signup | `Seu código de verificação: {{ .Token }}` | `confirmar-cadastro.html` |
   | Reset password | `Código para redefinir sua senha: {{ .Token }}` | `recuperar-senha.html` |
   | Change email address | `Confirme seu novo e-mail: {{ .Token }}` | `alterar-email.html` |

---

## 2. Envio de e-mail (SMTP)

O e-mail padrão do Supabase serve só para testes: **envia apenas para membros da equipe do
projeto e poucas mensagens por hora**. Para qualquer pessoa conseguir se cadastrar, configure
um SMTP próprio em **Authentication → Emails → SMTP Settings → Enable custom SMTP**.

### Opção A — Gmail (mais simples para projeto acadêmico)

1. Na conta Google: ative a **Verificação em duas etapas**.
2. Acesse <https://myaccount.google.com/apppasswords> → crie uma **senha de app** ("Supabase").
3. No Supabase:

   | Campo | Valor |
   |---|---|
   | Sender email | seu.email@gmail.com |
   | Sender name | Energia Inteligente |
   | Host | `smtp.gmail.com` |
   | Port | `465` |
   | Username | seu.email@gmail.com |
   | Password | a senha de app de 16 letras (sem espaços) |

   Limite do Gmail: ~500 e-mails/dia — sobra para o projeto.

### Opção B — Brevo (gratuito, 300 e-mails/dia)

Crie conta em <https://www.brevo.com> → **SMTP & API** → gere uma *SMTP key*.
Host `smtp-relay.brevo.com`, porta `587`, usuário = login SMTP mostrado no painel,
senha = SMTP key. Verifique o remetente em *Senders*.

### Opção C — Resend

Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = API key.
Exige um **domínio verificado** para enviar a qualquer destinatário.

Depois de ativar o SMTP, aumente o limite em **Authentication → Rate Limits → Rate limit
for sending emails** (ex.: 30 por hora).

**Teste:** crie uma conta no site com um e-mail seu. O código deve chegar em até 1 minuto
(confira o spam). Se não chegar: **Authentication → Logs** mostra o erro do SMTP.

---

## 3. Deploy na Vercel

1. Suba a pasta do projeto para um repositório no GitHub (o `.gitignore` já exclui `.env`,
   `node_modules` e `firmware/**/config.h`).
2. Em <https://vercel.com> → **Add New → Project** → importe o repositório.
   - Framework: **Vite** (detectado automaticamente; o `vercel.json` já configura).
3. **Environment Variables** (Production, Preview e Development):

   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
   | `ALLOWED_ORIGINS` | `https://SEU-PROJETO.vercel.app` |

4. **Deploy.** Ao terminar, abra `https://SEU-PROJETO.vercel.app/api/health` — deve responder
   `{"ok":true, "configured":true, ...}`.
5. Volte ao Supabase e confirme a **Site URL** com essa URL.

> Mudou alguma variável `VITE_*`? Faça **Redeploy**: elas são embutidas no build do frontend.

---

## 4. Rodar no computador (desenvolvimento)

Requisitos: **Node.js 20+**.

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env
# edite o .env com as chaves do Supabase
npm run dev
```

- Site: <http://localhost:5173>
- API local: as rotas `/api/*` rodam em `localhost:3001` e o Vite repassa automaticamente.

Testar o envio sem hardware (depois de cadastrar um dispositivo no site):

```bash
# Linux/macOS
DEVICE_ID=ESP32-001 DEVICE_KEY=ek_... npm run simulate
# Windows (PowerShell)
$env:DEVICE_ID="ESP32-001"; $env:DEVICE_KEY="ek_..."; npm run simulate
```

Para apontar o simulador para o site publicado: `API_URL=https://SEU-PROJETO.vercel.app`.
⚠️ O simulador grava dados **falsos** no banco — use só para testes; para apresentar sem
hardware, use o **Modo demonstração** (que é sinalizado na tela).

Testes automáticos da validação: `npm test`.

---

## 5. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Tela "Supabase não configurado" | faltam `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (ou faltou redeploy) |
| Código de verificação não chega | SMTP não configurado / limite de e-mails / caixa de spam |
| "Código inválido ou expirado" | código antigo (use o último recebido) ou expirou (1 h) |
| Cadastro cai direto logado, sem código | *Confirm email* está desligado no Supabase |
| `/api/health` com `"configured": false` | faltam `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` na Vercel |
| ESP32 recebe 401 | `DEVICE_ID`/`DEVICE_KEY` errados — gere uma nova chave |
| ESP32 recebe 429 | enviando mais de 1 vez por segundo |
| Dashboard não atualiza sozinho | tabela fora da publicação `supabase_realtime` (ele ainda atualiza a cada 60 s) |
| Dispositivo não fica "offline" | `cron.sql` não foi executado (o status na tela ainda é calculado pelo navegador) |
