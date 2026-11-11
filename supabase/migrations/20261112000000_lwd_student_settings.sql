-- Learning with Dina — per-student settings set by the teacher (the level ceiling). Stored as platform
-- records of kind 'student' (one row per student, id `student-<uuid>`): the teacher writes them, the
-- student reads only their own row, same scoping as every other platform record.
alter table public.lwd_platform drop constraint if exists lwd_platform_kind_check;
alter table public.lwd_platform add constraint lwd_platform_kind_check check (kind in ('booking', 'homework', 'feedback', 'activity', 'invoice', 'config', 'credit', 'student'));
