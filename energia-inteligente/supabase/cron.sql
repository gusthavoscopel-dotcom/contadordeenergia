-- =====================================================================
-- Energia Inteligente — verificações periódicas (pg_cron)
--
-- Rode DEPOIS do schema.sql. Cria duas rotinas no próprio banco:
--   • a cada 1 minuto: marca ESP32 sem enviar dados como OFFLINE (+ alerta)
--   • a cada 5 minutos: detecta cômodos consumindo bem acima da média (+ alerta)
--
-- Se o `create extension` der erro de permissão, ative em:
-- Supabase → Database → Extensions → pg_cron → Enable, e rode de novo.
-- =====================================================================

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- Dispositivos que pararam de enviar dados
-- ---------------------------------------------------------------------
create or replace function public.check_offline_devices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_count integer := 0;
begin
  for v_row in
    update public.devices d
       set status = 'offline'
      from public.residences r
     where r.id = d.residence_id
       and d.status = 'online'
       and (d.last_seen is null or d.last_seen < now() - make_interval(secs => r.offline_after_s))
    returning d.id, d.user_id, d.nome, d.device_id, r.notify_offline
  loop
    if v_row.notify_offline then
      insert into public.alerts (user_id, device_id, tipo, mensagem)
      values (v_row.user_id, v_row.id, 'dispositivo_offline',
              format('Não recebemos dados do dispositivo %s (%s) recentemente.', v_row.nome, v_row.device_id));
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Consumo elevado: potência média dos últimos 15 min comparada com a
-- média do mesmo cômodo nos 7 dias anteriores (ignorando a última hora).
-- Dispara quando está >= 30% acima da média. Um alerta por cômodo/hora.
-- ---------------------------------------------------------------------
create or replace function public.check_consumption_alerts(p_threshold numeric default 0.30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_pct   integer;
  v_count integer := 0;
begin
  for v_row in
    with recent as (
      select room_id, user_id, avg(power_w) as avg_recent
        from public.readings
       where measured_at > now() - interval '15 minutes'
         and room_id is not null
       group by room_id, user_id
    )
    select rc.room_id, rc.user_id, rc.avg_recent, rm.nome,
           (select avg(h.power_w)
              from public.readings h
             where h.room_id = rc.room_id
               and h.measured_at between now() - interval '7 days' and now() - interval '1 hour') as avg_hist
      from recent rc
      join public.rooms rm on rm.id = rc.room_id
      join public.residences rs on rs.id = rm.residence_id
     where rs.notify_high_consumption
  loop
    continue when v_row.avg_hist is null or v_row.avg_hist < 5;
    continue when v_row.avg_recent < v_row.avg_hist * (1 + p_threshold);
    continue when exists (
      select 1 from public.alerts a
       where a.room_id = v_row.room_id and a.tipo = 'consumo_elevado'
         and a.created_at > now() - interval '1 hour');

    v_pct := round((v_row.avg_recent / v_row.avg_hist - 1) * 100);
    insert into public.alerts (user_id, room_id, tipo, mensagem, valor, limite)
    values (v_row.user_id, v_row.room_id, 'consumo_elevado',
            format('%s está consumindo %s%% mais energia do que a média dos últimos 7 dias.', v_row.nome, v_pct),
            round(v_row.avg_recent, 2), round(v_row.avg_hist, 2));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.check_offline_devices() from public, anon, authenticated;
revoke all on function public.check_consumption_alerts(numeric) from public, anon, authenticated;

-- Agenda (recria se já existir)
do $$
begin
  perform cron.unschedule('energia-offline') where exists (select 1 from cron.job where jobname = 'energia-offline');
  perform cron.unschedule('energia-consumo') where exists (select 1 from cron.job where jobname = 'energia-consumo');
end;
$$;

select cron.schedule('energia-offline', '* * * * *',   'select public.check_offline_devices()');
select cron.schedule('energia-consumo', '*/5 * * * *', 'select public.check_consumption_alerts()');
