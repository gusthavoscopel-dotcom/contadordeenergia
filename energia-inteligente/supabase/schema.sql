-- =====================================================================
-- Energia Inteligente — schema do banco (Supabase / PostgreSQL)
--
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo
-- inteiro → Run. Depois rode também `cron.sql` (verificações periódicas).
--
-- Usuários e senhas ficam em `auth.users` (Supabase Auth). A senha é
-- armazenada como hash bcrypt pelo próprio Supabase — nunca em texto puro.
-- A tabela `profiles` guarda os dados públicos do usuário (nome, e-mail).
--
-- Segurança: todas as tabelas usam Row Level Security (RLS). Cada linha
-- tem `user_id` e as políticas só liberam linhas onde user_id = auth.uid().
-- Assim o usuário A nunca enxerga dados do usuário B, mesmo usando a
-- chave pública (anon key) diretamente.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PERFIS (espelho público de auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  nome             text not null default '',
  email            text,
  email_verificado boolean not null default false,
  created_at       timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, email_verificado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém e-mail / verificação sincronizados
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set email = new.email,
         email_verificado = new.email_confirmed_at is not null
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------
-- 2. RESIDÊNCIAS (uma por usuário) + configurações
-- ---------------------------------------------------------------------
create table if not exists public.residences (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique default auth.uid()
                             references auth.users (id) on delete cascade,
  nome                     text not null default 'Minha Casa' check (char_length(nome) between 1 and 80),
  tarifa_kwh               numeric(10, 4) not null default 0 check (tarifa_kwh >= 0 and tarifa_kwh < 100),
  power_limit_w            numeric(10, 2) not null default 2000 check (power_limit_w > 0),
  offline_after_s          integer not null default 30 check (offline_after_s between 10 and 3600),
  notify_high_consumption  boolean not null default true,
  notify_offline           boolean not null default true,
  notify_high_power        boolean not null default true,
  demo_mode                text not null default 'auto' check (demo_mode in ('auto', 'on', 'off')),
  created_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CÔMODOS
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id             uuid primary key default gen_random_uuid(),
  residence_id   uuid not null references public.residences (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome           text not null check (char_length(nome) between 1 and 40),
  icone          text not null default 'home',
  power_limit_w  numeric(10, 2) check (power_limit_w is null or power_limit_w > 0),
  created_at     timestamptz not null default now()
);
create unique index if not exists rooms_unique_name on public.rooms (residence_id, lower(nome));
create index if not exists rooms_user_idx on public.rooms (user_id);

-- ---------------------------------------------------------------------
-- 4. DISPOSITIVOS (ESP32)
--    device_id  = identificador legível e ÚNICO (ex.: ESP32-001)
--    api_key_hash = SHA-256 da chave secreta do dispositivo. A chave em si
--    só é mostrada uma vez, na criação; o banco nunca guarda a chave pura.
-- ---------------------------------------------------------------------
create table if not exists public.devices (
  id            uuid primary key default gen_random_uuid(),
  residence_id  uuid not null references public.residences (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id     text not null unique check (device_id ~ '^[A-Za-z0-9_-]{3,40}$'),
  nome          text not null check (char_length(nome) between 1 and 60),
  api_key_hash  text not null check (api_key_hash ~ '^[0-9a-f]{64}$'),
  status        text not null default 'offline' check (status in ('online', 'offline')),
  last_seen     timestamptz,
  firmware      text,
  created_at    timestamptz not null default now()
);
create index if not exists devices_user_idx on public.devices (user_id);

-- ---------------------------------------------------------------------
-- 5. SENSORES (canal do ESP32 → cômodo)
-- ---------------------------------------------------------------------
create table if not exists public.sensors (
  id         uuid primary key default gen_random_uuid(),
  device_id  uuid not null references public.devices (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  room_id    uuid references public.rooms (id) on delete set null,
  canal      integer not null check (canal between 1 and 32),
  nome       text not null default '',
  created_at timestamptz not null default now(),
  unique (device_id, canal)
);
create index if not exists sensors_user_idx on public.sensors (user_id);

-- ---------------------------------------------------------------------
-- 6. LEITURAS
--    power_w / voltage / current  → dado MEDIDO (vem do sensor)
--    energy_kwh                   → dado CALCULADO pelo sistema
--    room_id é gravado no momento da leitura: se o sensor for trocado de
--    cômodo depois, o histórico continua no cômodo onde foi medido.
-- ---------------------------------------------------------------------
create table if not exists public.readings (
  id           bigint generated always as identity primary key,
  sensor_id    uuid not null references public.sensors (id) on delete cascade,
  room_id      uuid references public.rooms (id) on delete set null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  power_w      numeric(10, 2) not null check (power_w >= 0),
  voltage      numeric(8, 2),
  current      numeric(9, 4),
  energy_kwh   numeric(16, 9) not null default 0,
  measured_at  timestamptz not null default now()
);
create index if not exists readings_user_time_idx   on public.readings (user_id, measured_at desc);
create index if not exists readings_sensor_time_idx on public.readings (sensor_id, measured_at desc);
create index if not exists readings_room_time_idx   on public.readings (room_id, measured_at desc);

-- ---------------------------------------------------------------------
-- 7. ALERTAS
-- ---------------------------------------------------------------------
create table if not exists public.alerts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  room_id      uuid references public.rooms (id) on delete set null,
  device_id    uuid references public.devices (id) on delete set null,
  tipo         text not null check (tipo in ('potencia_elevada', 'consumo_elevado', 'dispositivo_offline')),
  mensagem     text not null,
  valor        numeric(12, 2),
  limite       numeric(12, 2),
  visualizado  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists alerts_user_time_idx on public.alerts (user_id, created_at desc);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles   enable row level security;
alter table public.residences enable row level security;
alter table public.rooms      enable row level security;
alter table public.devices    enable row level security;
alter table public.sensors    enable row level security;
alter table public.readings   enable row level security;
alter table public.alerts     enable row level security;

-- profiles: só o próprio perfil; o usuário pode alterar apenas o nome
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (nome) on public.profiles to authenticated;

-- residences
drop policy if exists residences_all on public.residences;
create policy residences_all on public.residences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- rooms: além de ser do usuário, a residência precisa ser dele
drop policy if exists rooms_all on public.rooms;
create policy rooms_all on public.rooms for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.residences r where r.id = rooms.residence_id and r.user_id = auth.uid())
  );

-- devices
drop policy if exists devices_all on public.devices;
create policy devices_all on public.devices for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.residences r where r.id = devices.residence_id and r.user_id = auth.uid())
  );
-- status/last_seen são controlados apenas pelo servidor
revoke update on public.devices from authenticated;
grant update (nome, api_key_hash) on public.devices to authenticated;

-- sensors: o dispositivo e o cômodo vinculados precisam ser do usuário
drop policy if exists sensors_all on public.sensors;
create policy sensors_all on public.sensors for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.devices d where d.id = sensors.device_id and d.user_id = auth.uid())
    and (sensors.room_id is null or exists (select 1 from public.rooms r where r.id = sensors.room_id and r.user_id = auth.uid()))
  );

-- readings: o usuário só LÊ. Quem grava é a API (service role) via ingest_readings().
drop policy if exists readings_select on public.readings;
create policy readings_select on public.readings for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.readings from authenticated, anon;

-- alerts: ler, marcar como visualizado, excluir
drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts for select to authenticated using (user_id = auth.uid());
drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists alerts_delete on public.alerts;
create policy alerts_delete on public.alerts for delete to authenticated using (user_id = auth.uid());
revoke insert on public.alerts from authenticated, anon;
revoke update on public.alerts from authenticated;
grant update (visualizado) on public.alerts to authenticated;

-- Visitantes não logados não acessam nada
revoke all on public.profiles, public.residences, public.rooms, public.devices,
              public.sensors, public.readings, public.alerts from anon;

-- =====================================================================
-- FUNÇÕES DE CONSULTA (security invoker → respeitam o RLS)
-- =====================================================================

-- Última leitura de cada sensor dentro da janela (potência "agora")
create or replace function public.latest_readings(p_window_s integer default 60)
returns table (sensor_id uuid, room_id uuid, power_w numeric, voltage numeric, current numeric, measured_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select distinct on (r.sensor_id)
         r.sensor_id, r.room_id, r.power_w, r.voltage, r.current, r.measured_at
    from public.readings r
   where r.user_id = auth.uid()
     and r.measured_at > now() - make_interval(secs => greatest(p_window_s, 5))
   order by r.sensor_id, r.measured_at desc;
$$;

-- Energia (kWh) por cômodo num intervalo
create or replace function public.energy_by_room(p_from timestamptz, p_to timestamptz)
returns table (room_id uuid, kwh numeric)
language sql stable security invoker set search_path = public
as $$
  select r.room_id, coalesce(sum(r.energy_kwh), 0) as kwh
    from public.readings r
   where r.user_id = auth.uid()
     and r.measured_at >= p_from and r.measured_at < p_to
   group by r.room_id;
$$;

-- Energia (kWh) agrupada por hora / dia / mês, opcionalmente de um cômodo
create or replace function public.energy_by_bucket(
  p_from   timestamptz,
  p_to     timestamptz,
  p_bucket text default 'day',
  p_tz     text default 'America/Sao_Paulo',
  p_room   uuid default null
)
returns table (bucket timestamp, kwh numeric)
language plpgsql stable security invoker set search_path = public
as $$
begin
  if p_bucket not in ('hour', 'day', 'month') then
    raise exception 'bucket inválido: %', p_bucket;
  end if;
  if p_to - p_from > interval '400 days' then
    raise exception 'intervalo muito grande';
  end if;

  return query
    select date_trunc(p_bucket, r.measured_at at time zone p_tz) as bucket,
           coalesce(sum(r.energy_kwh), 0) as kwh
      from public.readings r
     where r.user_id = auth.uid()
       and r.measured_at >= p_from and r.measured_at < p_to
       and (p_room is null or r.room_id = p_room)
     group by 1
     order by 1;
end;
$$;

grant execute on function public.latest_readings(integer) to authenticated;
grant execute on function public.energy_by_room(timestamptz, timestamptz) to authenticated;
grant execute on function public.energy_by_bucket(timestamptz, timestamptz, text, text, uuid) to authenticated;

-- =====================================================================
-- INGESTÃO (chamada SOMENTE pela API /api/energy/readings com service role)
--
-- p_device : id interno (uuid) do dispositivo, já autenticado pela API
-- p_items  : [{ "sensor": 1, "power": 350.5, "voltage": 127, "current": 2.76 }, ...]
-- p_ts     : horário da medição (validado pela API)
--
-- Cálculo da energia (dado CALCULADO):
--   energia (kWh) = potência média (W) × tempo (h) / 1000
--   potência média = (potência anterior + potência atual) / 2   (regra do trapézio)
--   tempo = intervalo desde a leitura anterior do mesmo sensor, limitado a
--           p_max_gap_s. Se o ESP32 ficou desligado, não "inventamos" consumo
--           para o período sem dados.
-- =====================================================================
create or replace function public.ingest_readings(
  p_device     uuid,
  p_items      jsonb,
  p_ts         timestamptz default now(),
  p_firmware   text default null,
  p_max_gap_s  integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev        public.devices%rowtype;
  v_res        public.residences%rowtype;
  v_item       jsonb;
  v_canal      integer;
  v_power      numeric;
  v_voltage    numeric;
  v_current    numeric;
  v_sensor     public.sensors%rowtype;
  v_prev       record;
  v_dt         numeric;
  v_energy     numeric;
  v_room       public.rooms%rowtype;
  v_limit      numeric;
  v_inserted   integer := 0;
  v_alerts     integer := 0;
  v_unmapped   integer[] := '{}';
begin
  select * into v_dev from public.devices where id = p_device for update;
  if not found then
    raise exception 'device_not_found';
  end if;

  -- Rate limit simples por dispositivo: no máximo 1 envio por segundo
  if v_dev.last_seen is not null and v_dev.last_seen > now() - interval '900 milliseconds' then
    raise exception 'rate_limited';
  end if;

  select * into v_res from public.residences where id = v_dev.residence_id;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_canal   := (v_item ->> 'sensor')::integer;
    v_power   := round((v_item ->> 'power')::numeric, 2);
    v_voltage := round(nullif(v_item ->> 'voltage', '')::numeric, 2);
    v_current := round(nullif(v_item ->> 'current', '')::numeric, 4);

    -- Sensor do canal (cria automaticamente, ainda sem cômodo, se não existir)
    select * into v_sensor from public.sensors where device_id = v_dev.id and canal = v_canal;
    if not found then
      insert into public.sensors (device_id, user_id, canal, nome)
      values (v_dev.id, v_dev.user_id, v_canal, 'Sensor ' || lpad(v_canal::text, 2, '0'))
      returning * into v_sensor;
    end if;

    -- Leitura anterior do mesmo sensor → intervalo de tempo
    select r.power_w, r.measured_at into v_prev
      from public.readings r
     where r.sensor_id = v_sensor.id
     order by r.measured_at desc
     limit 1;

    v_energy := 0;
    if v_prev.measured_at is not null then
      v_dt := extract(epoch from (p_ts - v_prev.measured_at));
      if v_dt > 0 then
        v_dt := least(v_dt, p_max_gap_s);
        v_energy := ((v_prev.power_w + v_power) / 2.0) * (v_dt / 3600.0) / 1000.0;
      end if;
    end if;

    insert into public.readings (sensor_id, room_id, user_id, power_w, voltage, current, energy_kwh, measured_at)
    values (v_sensor.id, v_sensor.room_id, v_dev.user_id, v_power, v_voltage, v_current, v_energy, p_ts);
    v_inserted := v_inserted + 1;

    if v_sensor.room_id is null then
      v_unmapped := v_unmapped || v_canal;
      continue;
    end if;

    -- Alerta: potência acima do limite (do cômodo ou, se não houver, da residência)
    if v_res.notify_high_power then
      select * into v_room from public.rooms where id = v_sensor.room_id;
      v_limit := coalesce(v_room.power_limit_w, v_res.power_limit_w);
      if v_power > v_limit and not exists (
           select 1 from public.alerts a
            where a.user_id = v_dev.user_id and a.room_id = v_room.id
              and a.tipo = 'potencia_elevada'
              and a.created_at > now() - interval '10 minutes')
      then
        insert into public.alerts (user_id, room_id, device_id, tipo, mensagem, valor, limite)
        values (
          v_dev.user_id, v_room.id, v_dev.id, 'potencia_elevada',
          format('Foi detectado um consumo de %s W em %s, acima do limite de %s W.',
                 to_char(v_power, 'FM999G999G990'), v_room.nome, to_char(v_limit, 'FM999G999G990')),
          v_power, v_limit
        );
        v_alerts := v_alerts + 1;
      end if;
    end if;
  end loop;

  -- Se estava offline, resolve o estado
  update public.devices
     set last_seen = now(),
         status = 'online',
         firmware = coalesce(left(p_firmware, 40), firmware)
   where id = v_dev.id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'alerts', v_alerts,
    'unmappedSensors', to_jsonb(v_unmapped),
    'measuredAt', p_ts
  );
end;
$$;

revoke all on function public.ingest_readings(uuid, jsonb, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.ingest_readings(uuid, jsonb, timestamptz, text, integer) to service_role;

-- =====================================================================
-- REALTIME: o dashboard escuta novas leituras, alertas e status do ESP32
-- (o Supabase Realtime respeita as políticas de RLS acima)
-- =====================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.readings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.alerts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.devices;
  exception when duplicate_object then null;
  end;
end;
$$;
