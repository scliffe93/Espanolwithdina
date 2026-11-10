-- Learning with Dina — invoicing. Invoices and the teacher's invoicing settings are stored as
-- platform records (same table, same role scoping): students read only their own invoices,
-- the teacher writes them; 'config' rows belong to the teacher herself.
alter table public.lwd_platform drop constraint if exists lwd_platform_kind_check;
alter table public.lwd_platform add constraint lwd_platform_kind_check check (kind in ('booking', 'homework', 'feedback', 'activity', 'invoice', 'config'));
