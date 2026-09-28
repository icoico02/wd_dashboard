-- attendance_records：上下班打卡记录
-- 说明：如果复用 workTime 已有的 Supabase 项目，此表已存在，无需执行。
-- 本脚本用于全新 Supabase 项目时补齐打卡表。

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, work_date)
);

alter table public.attendance_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance_records'
      and policyname = 'Users can view own attendance'
  ) then
    create policy "Users can view own attendance"
    on public.attendance_records for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance_records'
      and policyname = 'Users can insert own attendance'
  ) then
    create policy "Users can insert own attendance"
    on public.attendance_records for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance_records'
      and policyname = 'Users can update own attendance'
  ) then
    create policy "Users can update own attendance"
    on public.attendance_records for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance_records'
      and policyname = 'Users can delete own attendance'
  ) then
    create policy "Users can delete own attendance"
    on public.attendance_records for delete
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$$;

-- 开启 Realtime（打卡页可选）
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance_records'
  ) then
    alter publication supabase_realtime add table public.attendance_records;
  end if;
end
$$;
