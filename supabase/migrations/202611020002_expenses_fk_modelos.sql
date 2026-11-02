-- Alinha a homologação com a produção: despesas ligadas aos modelos (fixas e recorrentes).
alter table public.expenses
  add constraint expenses_expense_template_id_fkey foreign key (expense_template_id) references public.expense_templates(id) on delete set null,
  add constraint expenses_recurring_template_id_fkey foreign key (recurring_template_id) references public.expense_templates(id) on delete set null;
