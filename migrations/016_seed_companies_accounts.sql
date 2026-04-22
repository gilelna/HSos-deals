BEGIN;

INSERT INTO companies (id, name, currency, entity_type)
VALUES
  ('com_us', 'Hadar Shemesh International LLC', 'USD', 'llc'),
  ('com_il', 'Accent''s Way LTD', 'ILS', 'ltd'),
  ('com_es', 'Hadar Shemesh', 'EUR', 'self_employed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (id, name, provider, currency, account_type, company_id)
VALUES
  ('acc_wise_usd', 'Wise USD', 'wise', 'USD', 'processor', 'com_us'),
  ('acc_wise_eur', 'Wise EUR', 'wise', 'EUR', 'processor', 'com_us'),
  ('acc_stripe_hs', 'Stripe - HS Courses', 'stripe', 'USD', 'processor', 'com_us'),
  ('acc_stripe_old', 'Stripe - legacy', 'stripe', 'USD', 'processor', 'com_us'),
  ('acc_stripe_connect', 'Stripe - HS connect', 'stripe', 'USD', 'processor', 'com_us'),
  ('acc_brex_us_6004', 'Brex Card 6004 — Private Policy', 'brex', 'USD', 'bank', 'com_us'),
  ('acc_brex_us_2119', 'Brex Card 2119 — General', 'brex', 'USD', 'bank', 'com_us'),
  ('acc_brex_us_1706', 'Brex Card 1706 — Leadership', 'brex', 'USD', 'bank', 'com_us'),
  ('acc_amex_1004', 'Amex card Hadar', 'amex', 'EUR', 'bank', 'com_us'),
  ('acc_paypal_us', 'PayPal (US)', 'paypal', 'MULTI', 'processor', 'com_us'),
  ('acc_mizrachi_il', 'Mizrachi Tefahot (IL)', 'mizrachi_tefahot', 'ILS', 'bank', 'com_il'),
  ('acc_isracard_usd', 'isracard (USD)', 'isracard', 'USD', 'card', 'com_il'),
  ('acc_isracard_ils', 'isracard (ILS)', 'isracard', 'ILS', 'card', 'com_il'),
  ('acc_visa_max_usd', 'Visa Max (USD)', 'visa_max', 'USD', 'card', 'com_il'),
  ('acc_visa_max_ils', 'Visa Max (ILS)', 'visa_max', 'ILS', 'card', 'com_il'),
  ('acc_paypal_il', 'PayPal (IL)', 'paypal', 'MULTI', 'processor', 'com_il'),
  ('acc_greeninvoice_il', 'green invoice docs', 'greeninvoice', 'ILS', 'document', 'com_il'),
  ('acc_santander_es', 'Santander (ES)', 'santander', 'EUR', 'bank', 'com_es')
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- SELECT id, name, currency, entity_type FROM companies ORDER BY id;
-- SELECT id, name, provider, currency, account_type, company_id FROM accounts ORDER BY company_id, id;
-- Expected: 3 companies, 18 accounts
