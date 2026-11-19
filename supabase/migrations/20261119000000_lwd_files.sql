-- Learning with Dina — the teacher's own files: PDFs and photos attached to homework, and each student's
-- learning bank (kind 'resource': an explanation that stays there to come back to).
-- The files live in a private Storage bucket. Nobody reads it directly: the `account` Edge Function checks
-- who is asking and signs a short-lived link (teacher: any file; student: only files their own rows point at).

alter table public.lwd_platform drop constraint if exists lwd_platform_kind_check;
alter table public.lwd_platform add constraint lwd_platform_kind_check check (kind in ('booking', 'homework', 'feedback', 'activity', 'invoice', 'config', 'credit', 'student', 'lesson', 'lessonwork', 'resource'));

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('lwd-files', 'lwd-files', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/plain'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
