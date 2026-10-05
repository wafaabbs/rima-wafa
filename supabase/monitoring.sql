-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- Menyimpan hitungan kunjungan, sesi anonim acak, halaman, lokasi perkiraan (kota/negara), dan pesan error.
-- Aman dijalankan ulang untuk memperbarui tabel yang sudah ada.
create table if not exists public.site_monitor (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('view', 'error')),
  session_id text not null,
  page text not null,
  message text,
  country text,
  country_code text,
  region text,
  city text,
  created_at timestamptz not null default now()
);

-- Lokasi perkiraan dari IP geolocation (geojs.io / ipwho.is). Alamat IP tidak disimpan.
alter table public.site_monitor add column if not exists country text;
alter table public.site_monitor add column if not exists country_code text;
alter table public.site_monitor add column if not exists region text;
alter table public.site_monitor add column if not exists city text;

create index if not exists site_monitor_created_idx on public.site_monitor (created_at desc);
create index if not exists site_monitor_type_created_idx on public.site_monitor (event_type, created_at desc);

alter table public.site_monitor enable row level security;
grant insert on public.site_monitor to anon, authenticated;
drop policy if exists "monitor insert" on public.site_monitor;
create policy "monitor insert" on public.site_monitor
  for insert to anon, authenticated
  with check (event_type in ('view', 'error') and char_length(session_id) between 1 and 100
    and char_length(page) between 1 and 180
    and (message is null or char_length(message) <= 500)
    and (country is null or char_length(country) <= 80)
    and (country_code is null or char_length(country_code) <= 2)
    and (region is null or char_length(region) <= 80)
    and (city is null or char_length(city) <= 80));

-- Agregat saja bisa dibaca dari browser dashboard; identitas pengunjung dan alamat IP tidak dicatat.
create or replace function public.monitor_summary()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from site_monitor where event_type = 'view'),
    'today', (select count(*) from site_monitor where event_type = 'view' and created_at >= date_trunc('day', now())),
    'sessions_today', (select count(distinct session_id) from site_monitor where event_type = 'view' and created_at >= date_trunc('day', now())),
    'errors_today', (select count(*) from site_monitor where event_type = 'error' and created_at >= date_trunc('day', now())),
    'views_by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'views', d.views) order by d.day), '[]'::jsonb)
      from (select date_trunc('day', created_at)::date as day, count(*) as views from site_monitor
        where event_type = 'view' and created_at >= now() - interval '7 days' group by 1) d),
    'recent_errors', (select coalesce(jsonb_agg(jsonb_build_object('created_at', e.created_at, 'page', e.page, 'message', e.message) order by e.created_at desc), '[]'::jsonb)
      from (select created_at, page, message from site_monitor where event_type = 'error' order by created_at desc limit 12) e),
    'top_cities', (select coalesce(jsonb_agg(jsonb_build_object('city', c.city, 'region', c.region, 'country', c.country, 'sessions', c.sessions) order by c.sessions desc), '[]'::jsonb)
      from (select city, max(region) as region, max(country) as country, count(distinct session_id) as sessions from site_monitor
        where event_type = 'view' and city is not null group by city order by 4 desc limit 10) c),
    'top_countries', (select coalesce(jsonb_agg(jsonb_build_object('country', c.country, 'country_code', c.country_code, 'sessions', c.sessions) order by c.sessions desc), '[]'::jsonb)
      from (select country, max(country_code) as country_code, count(distinct session_id) as sessions from site_monitor
        where event_type = 'view' and country is not null group by country order by 3 desc limit 10) c),
    'unknown_location', (select count(distinct session_id) from site_monitor where event_type = 'view' and country is null)
  );
$$;
revoke all on function public.monitor_summary() from public;
grant execute on function public.monitor_summary() to anon, authenticated;
