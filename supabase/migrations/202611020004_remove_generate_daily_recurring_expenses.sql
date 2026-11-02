-- Remove a função private.generate_daily_recurring_expenses, que existia só na produção e não era usada pelo código.
drop function if exists private.generate_daily_recurring_expenses();
