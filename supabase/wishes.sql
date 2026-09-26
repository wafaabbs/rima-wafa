-- Jalankan sekali di Supabase Dashboard > SQL Editor.

create table if not exists public.wishes (
  id          bigint generated always as identity primary key,
  parent_id   bigint references public.wishes(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  message     text not null check (char_length(message) between 1 and 500),
  attendance  text check (attendance in ('hadir', 'tidak_hadir', 'ragu')),
  like_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists wishes_parent_idx on public.wishes (parent_id);

create table if not exists public.wish_likes (
  wish_id    bigint not null references public.wishes(id) on delete cascade,
  device_id  uuid   not null,
  created_at timestamptz not null default now(),
  primary key (wish_id, device_id)
);

-- Tamu tidak bisa memalsukan like_count/created_at, dan balasan selalu satu tingkat.
create or replace function public.wishes_before_insert()
returns trigger language plpgsql as $$
declare
  grand bigint;
begin
  new.name       := btrim(new.name);
  new.message    := btrim(new.message);
  new.like_count := 0;
  new.created_at := now();
  if new.parent_id is not null then
    new.attendance := null;
    select parent_id into grand from public.wishes where id = new.parent_id;
    if grand is not null then
      new.parent_id := grand;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists wishes_before_insert on public.wishes;
create trigger wishes_before_insert
  before insert on public.wishes
  for each row execute function public.wishes_before_insert();

alter table public.wishes     enable row level security;
alter table public.wish_likes enable row level security;

drop policy if exists "wishes readable" on public.wishes;
create policy "wishes readable" on public.wishes
  for select to anon, authenticated using (true);

drop policy if exists "wishes insertable" on public.wishes;
create policy "wishes insertable" on public.wishes
  for insert to anon, authenticated with check (true);

-- wish_likes sengaja tanpa policy: hanya bisa diubah lewat fungsi di bawah.

create or replace function public.toggle_like(p_wish_id bigint, p_device_id uuid)
returns table (like_count integer, liked boolean)
language plpgsql security definer set search_path = public as $$
declare
  did_like boolean;
  cnt integer;
begin
  delete from wish_likes where wish_id = p_wish_id and device_id = p_device_id;
  if found then
    did_like := false;
  else
    insert into wish_likes (wish_id, device_id) values (p_wish_id, p_device_id);
    did_like := true;
  end if;

  update wishes w
     set like_count = (select count(*) from wish_likes l where l.wish_id = p_wish_id)
   where w.id = p_wish_id
  returning w.like_count into cnt;

  return query select cnt, did_like;
end $$;

create or replace function public.my_likes(p_device_id uuid)
returns setof bigint
language sql security definer set search_path = public stable as $$
  select wish_id from wish_likes where device_id = p_device_id;
$$;

revoke all on function public.toggle_like(bigint, uuid) from public;
revoke all on function public.my_likes(uuid) from public;
grant execute on function public.toggle_like(bigint, uuid) to anon, authenticated;
grant execute on function public.my_likes(uuid) to anon, authenticated;

-- Realtime: ucapan baru & perubahan jumlah like langsung muncul di semua tamu.
do $$
begin
  alter publication supabase_realtime add table public.wishes;
exception when duplicate_object then null;
end $$;
