-- Learning with Dina — admin role (sits above the teacher: sees every account and record,
-- changes roles, resets passwords, removes accounts). Granted to the usernames in the
-- ADMIN_USERNAMES secret of the Edge Function; never settable through the API.
alter table public.lwd_users drop constraint if exists lwd_users_role_check;
alter table public.lwd_users add constraint lwd_users_role_check check (role in ('student', 'teacher', 'admin'));
