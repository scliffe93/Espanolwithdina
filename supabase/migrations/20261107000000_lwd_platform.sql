-- Learning with Dina — teaching platform (teacher role, lessons, homework, feedback, activity).
-- Same security model as the accounts migration: RLS on, no policies, so only the
-- `account` Edge Function (server-side connection) can read or write, and it scopes
-- every query to the signed-in person's role: a student only their own rows, the
-- teacher her students'.

alter table public.lwd_users
  add column if not exists role text not null default 'student' check (role in ('student', 'teacher'));

create table if not exists public.lwd_platform (
  id text primary key,                                   -- client-generated uuid
  kind text not null check (kind in ('booking', 'homework', 'feedback', 'activity')),
  teacher_id uuid references public.lwd_users(id) on delete cascade,  -- who created it (null for a student's own activity)
  student_id uuid not null references public.lwd_users(id) on delete cascade,
  data jsonb not null,                                   -- the Booking / Homework / Feedback / ActivityEvent record
  updated_at timestamptz not null default now()
);
create index if not exists lwd_platform_student_idx on public.lwd_platform(student_id, kind);
create index if not exists lwd_platform_kind_idx on public.lwd_platform(kind, updated_at);

alter table public.lwd_platform enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.lwd_platform from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.lwd_platform from authenticated;
  end if;
end $$;
