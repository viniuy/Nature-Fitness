-- Nature Fitness sync tables, in the same Supabase project as the dashboard.
--
-- Each device keeps a full copy of the data and uses these tables to pass
-- changes between devices. The tables are also meant to be read and edited
-- directly (for example by the dashboard assistant), so key fields are real
-- columns and only nested data (sets, program days, Evolt readings) is jsonb.
--
-- Rules for anyone editing rows directly:
--   * Never hard-delete; set deleted = true so the delete reaches every device.
--   * updated_at (ms since epoch) decides which edit wins. A trigger bumps it
--     and server_ts on every write that does not set a newer updated_at itself,
--     so a plain UPDATE is enough for the apps to pick the change up.
--   * Keep the jsonb shapes described in the column comments.

-- ---------- programs ----------
create table if not exists public.gym_programs (
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  name       text not null,
  active     boolean not null default false,
  days       jsonb not null default '[]',
  weekdays   jsonb not null default '{}',
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  deleted    boolean not null default false,
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (owner_id, id)
);
comment on table public.gym_programs is 'Training programs for the Nature Fitness gym app. The active one is shown on the Today screen.';
comment on column public.gym_programs.days is 'Array of days: {id, tag, short, name, focus, warmup: [{id, title, detail}], exercises: [{id, name, sets, scheme, unit: "kg"|"+kg"|"cm"|null, hint, tier?, ramp?: {bar, reps: [n,n,n]}}]}. Exercise ids link logged sets across sessions; keep them stable.';
comment on column public.gym_programs.weekdays is 'Day of week (0 = Sunday) to day id, e.g. {"1": "d2"}.';

-- ---------- sessions ----------
create table if not exists public.gym_sessions (
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,            -- s_<date>_<day id>
  date       date not null,
  day_id     text not null,
  day_name   text not null default '',
  program_id text not null default '',
  note       text not null default '',
  sets       jsonb not null default '{}',
  exercises  jsonb not null default '{}',
  warm       jsonb not null default '{}',
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  deleted    boolean not null default false,
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (owner_id, id)
);
comment on table public.gym_sessions is 'Logged workouts, one row per date and program day.';
comment on column public.gym_sessions.sets is 'Exercise id to array of sets: {w: weight or null, r: reps or null, done: bool}. Weight is kg (or added kg / cm, see exercises.unit).';
comment on column public.gym_sessions.exercises is 'Exercise id to {name, unit} as it was when logged.';
comment on column public.gym_sessions.warm is 'Warm-up item id to true when ticked.';

-- ---------- body stats ----------
create table if not exists public.gym_body_stats (
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  date       date not null,
  source     text not null default 'manual' check (source in ('manual', 'evolt')),
  weight     numeric,
  waist      numeric,
  note       text,
  evolt      jsonb,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  deleted    boolean not null default false,
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (owner_id, id)
);
comment on table public.gym_body_stats is 'Weigh-ins and Evolt 360 body scans. weight is kg, waist is cm.';
comment on column public.gym_body_stats.evolt is 'Evolt Result Sheet readings: field to {value, status?, low?, high?, max?, share?}. Fields include leanBodyMass, skeletalMuscleMass, bodyFatMass, bodyFatPercent, visceralFatLevel, bmr, tee, bioAge, segmental leftArmLean etc, and nutrition targets.';

-- ---------- shared setup ----------
create or replace function public.gym_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_ts := clock_timestamp();
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    new.updated_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['gym_programs', 'gym_sessions', 'gym_body_stats'] loop
    execute format('create index if not exists %1$s_pull on public.%1$s (owner_id, server_ts)', t);
    execute format('drop trigger if exists %1$s_touch on public.%1$s', t);
    execute format('create trigger %1$s_touch before insert or update on public.%1$s for each row execute function public.gym_touch()', t);
    execute format('alter table public.%1$s enable row level security', t);
    -- Same model as the dashboard tables: own rows only, and only with MFA (aal2).
    execute format('drop policy if exists %1$s_owner_all on public.%1$s', t);
    execute format('create policy %1$s_owner_all on public.%1$s for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('drop policy if exists %1$s_require_aal2 on public.%1$s', t);
    execute format($p$create policy %1$s_require_aal2 on public.%1$s as restrictive for all to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2') with check ((select auth.jwt() ->> 'aal') = 'aal2')$p$, t);
    execute format('revoke all on public.%1$s from anon', t);
    execute format('grant select, insert, update on public.%1$s to authenticated', t);
  end loop;
end $$;

-- A flat view of every logged set, for quick questions like "best squat this month".
create or replace view public.gym_sets
with (security_invoker = true) as
select
  s.owner_id,
  s.date,
  s.day_name,
  x.key as exercise_id,
  coalesce(s.exercises -> x.key ->> 'name', x.key) as exercise,
  s.exercises -> x.key ->> 'unit' as unit,
  e.ordinality::int as set_no,
  (e.value ->> 'w')::numeric as weight,
  (e.value ->> 'r')::int as reps,
  coalesce((e.value ->> 'done')::boolean, false) as done
from public.gym_sessions s
cross join lateral jsonb_each(s.sets) as x(key, value)
cross join lateral jsonb_array_elements(x.value) with ordinality as e(value, ordinality)
where not s.deleted
  and (e.value ->> 'w' is not null or e.value ->> 'r' is not null);
revoke all on public.gym_sets from anon;
grant select on public.gym_sets to authenticated;

-- Push a batch from a device, keeping whichever version of each row was edited last.
create or replace function public.gym_push(programs jsonb default '[]', sessions jsonb default '[]', body jsonb default '[]')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n integer := 0;
  c integer;
begin
  if me is null then raise exception 'not signed in'; end if;

  insert into public.gym_programs as t (owner_id, id, name, active, days, weekdays, updated_at, deleted)
  select me, r.id, r.name, coalesce(r.active, false), coalesce(r.days, '[]'), coalesce(r.weekdays, '{}'), r.updated_at, coalesce(r.deleted, false)
  from jsonb_populate_recordset(null::public.gym_programs, programs) r
  on conflict (owner_id, id) do update
    set name = excluded.name, active = excluded.active, days = excluded.days, weekdays = excluded.weekdays,
        updated_at = excluded.updated_at, deleted = excluded.deleted
    where excluded.updated_at > t.updated_at;
  get diagnostics c = row_count; n := n + c;

  insert into public.gym_sessions as t (owner_id, id, date, day_id, day_name, program_id, note, sets, exercises, warm, updated_at, deleted)
  select me, r.id, r.date, r.day_id, coalesce(r.day_name, ''), coalesce(r.program_id, ''), coalesce(r.note, ''),
         coalesce(r.sets, '{}'), coalesce(r.exercises, '{}'), coalesce(r.warm, '{}'), r.updated_at, coalesce(r.deleted, false)
  from jsonb_populate_recordset(null::public.gym_sessions, sessions) r
  on conflict (owner_id, id) do update
    set date = excluded.date, day_id = excluded.day_id, day_name = excluded.day_name, program_id = excluded.program_id,
        note = excluded.note, sets = excluded.sets, exercises = excluded.exercises, warm = excluded.warm,
        updated_at = excluded.updated_at, deleted = excluded.deleted
    where excluded.updated_at > t.updated_at;
  get diagnostics c = row_count; n := n + c;

  insert into public.gym_body_stats as t (owner_id, id, date, source, weight, waist, note, evolt, updated_at, deleted)
  select me, r.id, r.date, coalesce(r.source, 'manual'), r.weight, r.waist, r.note, r.evolt, r.updated_at, coalesce(r.deleted, false)
  from jsonb_populate_recordset(null::public.gym_body_stats, body) r
  on conflict (owner_id, id) do update
    set date = excluded.date, source = excluded.source, weight = excluded.weight, waist = excluded.waist,
        note = excluded.note, evolt = excluded.evolt, updated_at = excluded.updated_at, deleted = excluded.deleted
    where excluded.updated_at > t.updated_at;
  get diagnostics c = row_count; n := n + c;

  return n;
end;
$$;

revoke all on function public.gym_push(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.gym_push(jsonb, jsonb, jsonb) to authenticated;
revoke all on function public.gym_touch() from public, anon, authenticated;
