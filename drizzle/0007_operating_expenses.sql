ALTER TABLE ad_expenses ADD COLUMN category TEXT NOT NULL DEFAULT 'ads';
ALTER TABLE ad_expenses ADD COLUMN cost_type TEXT NOT NULL DEFAULT 'variable';
CREATE INDEX ad_expenses_date_category ON ad_expenses(date, category);
