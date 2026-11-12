-- Learning with Dina — invoicing and lesson packages. Invoices and the teacher's invoicing settings are stored as
-- platform records (same table, same role scoping): students read only their own invoices,
-- the teacher writes them; 'config' rows belong to the teacher herself.
-- The setup script re-applies every migration on each run, so this list must never be narrower than a later
-- migration's: it carries 'student' (added in 20261112) so a re-run cannot reject rows that already exist.
alter table public.lwd_platform drop constraint if exists lwd_platform_kind_check;
alter table public.lwd_platform add constraint lwd_platform_kind_check check (kind in ('booking', 'homework', 'feedback', 'activity', 'invoice', 'config', 'credit', 'student'));
