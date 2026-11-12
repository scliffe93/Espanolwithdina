-- Learning with Dina — phone notifications (Web Push).
-- One row per device that has turned notifications on. The endpoint and keys come from the
-- browser; they let the server send that device an encrypted message and nothing else.
-- Row Level Security is ENABLED with NO policies, like every other table: only the Edge Function
-- can read or write, and it scopes every query to the signed-in user.
create table if not exists public.lwd_push (
  endpoint_hash text primary key,        -- SHA-256 of the endpoint (one row per device)
  user_id uuid not null references public.lwd_users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists lwd_push_user_idx on public.lwd_push(user_id);
alter table public.lwd_push enable row level security;
