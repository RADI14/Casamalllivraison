ALTER TABLE ad_expenses ADD COLUMN accounting_month TEXT;
UPDATE ad_expenses SET accounting_month=substr(date,1,7) WHERE category <> 'ads';
