-- Learning with Dina — the lesson room.
-- Two more kinds of platform record: 'lesson' (the plan, written by the teacher) and 'lessonwork' (the student's
-- answers during the lesson, written by the Edge Function on the student's behalf). The table's Row Level Security
-- (enabled, no policies) is unchanged: only the Edge Function reads or writes, and it decides who may see what.
alter table public.lwd_platform drop constraint if exists lwd_platform_kind_check;
alter table public.lwd_platform add constraint lwd_platform_kind_check check (kind in ('booking', 'homework', 'feedback', 'activity', 'invoice', 'config', 'credit', 'student', 'lesson', 'lessonwork', 'resource'));
