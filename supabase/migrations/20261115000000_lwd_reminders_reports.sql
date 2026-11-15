-- Learning with Dina — daily practice reminders and problem reports.
-- Row Level Security is ENABLED with NO policies, like every other table: only the Edge Function can read or write.

-- One row per person who has asked for a daily reminder: the time of day they chose, in their own time zone.
create table if not exists public.lwd_reminders (
  user_id uuid primary key references public.lwd_users(id) on delete cascade,
  enabled boolean not null default true,
  minute_of_day integer not null check (minute_of_day >= 0 and minute_of_day < 1440),
  tz text not null,
  last_sent text,                         -- the local date (YYYY-MM-DD) a reminder last went out, so it is one a day
  updated_at timestamptz not null default now()
);
alter table public.lwd_reminders enable row level security;

-- Problems the app ran into on someone's device (a page that failed, a voice that would not play), for the administrator.
-- They hold the problem, the page and the device type. Never a password, never answers. Removed with the account.
create table if not exists public.lwd_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.lwd_users(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  message text not null,
  page text not null default '',
  detail text not null default '',
  device text not null default '',
  build text not null default ''
);
create index if not exists lwd_reports_at_idx on public.lwd_reports(at desc);
alter table public.lwd_reports enable row level security;
