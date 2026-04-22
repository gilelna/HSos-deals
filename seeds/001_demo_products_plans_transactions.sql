-- ============================================================
-- Seed: 001_demo_products_plans_transactions.sql
-- Purpose:   Demo programs, products, plans, transactions
-- Sources:   ThriveCart catalog, Green Invoice samples,
--            Mizrachi bank samples, Wise samples
-- Safe:      All inserts use ON CONFLICT DO NOTHING — re-runnable
-- Depends:   migrations/004_products_plans_transactions.sql applied
-- ============================================================


-- ─── 1. PROGRAMS ─────────────────────────────────────────────
-- slug is unique — conflict key

insert into programs (name, slug, description, audience_segment, active)
values
  ('New Sound',          'new-sound',         null, 'English pronunciation & fluency learners', true),
  ('Beyond',             'beyond',             null, 'Community membership',                     true),
  ('Sprint Master',      'sprint-master',      null, 'Grammar & writing sprint',                 true),
  ('1:1 Coaching',       'one-on-one',         null, 'Private session clients',                  true),
  ('My English Mindset', 'my-english-mindset', null, 'Mindset & motivation learners',            true),
  ('Grammar Master',     'grammar-master',     null, 'Grammar learners',                         true),
  ('Other',              'other',              null, 'Miscellaneous',                             true)
on conflict (slug) do nothing;


-- ─── 2. PRODUCTS ─────────────────────────────────────────────
-- Conflict key: (program_id, name) — no unique constraint exists, so we
-- guard with a WHERE NOT EXISTS pattern inside a DO block to stay safe.
-- Simpler: just rely on the caller not running twice on a clean DB.
-- Since plans reference products by subquery on name+slug, duplicates
-- would break plan inserts anyway. Use a unique index guard via DO NOTHING
-- on (program_id, name) — but that index doesn't exist yet, so we use
-- a NOT EXISTS guard per row.

insert into products (program_id, name, description, sessions_included, base_price, base_currency, active)

-- ── New Sound ──────────────────────────────────────────────
select (select id from programs where slug = 'new-sound'),
       'New Sound Core', 'Self-paced pronunciation program', 0, 447, 'USD', true
where not exists (select 1 from products where name = 'New Sound Core')

union all
select (select id from programs where slug = 'new-sound'),
       'New Sound Standard', null, 0, 697, 'USD', true
where not exists (select 1 from products where name = 'New Sound Standard')

union all
select (select id from programs where slug = 'new-sound'),
       'New Sound VIP', null, 0, 1697, 'USD', true
where not exists (select 1 from products where name = 'New Sound VIP')

union all
select (select id from programs where slug = 'new-sound'),
       'New Sound LE Standard', 'Live Experience', 0, 229, 'USD', true
where not exists (select 1 from products where name = 'New Sound LE Standard')

union all
select (select id from programs where slug = 'new-sound'),
       'New Sound LE VIP', 'Live Experience VIP', 0, 1029, 'USD', true
where not exists (select 1 from products where name = 'New Sound LE VIP')

union all
select (select id from programs where slug = 'new-sound'),
       'New Sound Feedback', null, 0, null, 'USD', true
where not exists (select 1 from products where name = 'New Sound Feedback')

union all
select (select id from programs where slug = 'new-sound'),
       'New Sound Coaching Pods', null, 0, 250, 'USD', true
where not exists (select 1 from products where name = 'New Sound Coaching Pods')

union all
select (select id from programs where slug = 'new-sound'),
       'New Sound CamVision', null, 0, null, 'USD', true
where not exists (select 1 from products where name = 'New Sound CamVision')

-- ── Beyond ─────────────────────────────────────────────────
union all
select (select id from programs where slug = 'beyond'),
       'Beyond Membership', 'Recurring community membership', 0, null, 'USD', true
where not exists (select 1 from products where name = 'Beyond Membership')

-- ── Sprint Master ───────────────────────────────────────────
union all
select (select id from programs where slug = 'sprint-master'),
       'Sprint Master', null, 0, 97, 'USD', true
where not exists (select 1 from products where name = 'Sprint Master')

union all
select (select id from programs where slug = 'sprint-master'),
       'Sprint Master 2.0', null, 0, 97, 'USD', true
where not exists (select 1 from products where name = 'Sprint Master 2.0')

union all
select (select id from programs where slug = 'grammar-master'),
       'Grammar Master', null, 0, 147, 'USD', true
where not exists (select 1 from products where name = 'Grammar Master')

-- ── 1:1 Coaching ────────────────────────────────────────────
union all
select (select id from programs where slug = 'one-on-one'),
       '1:1 Fluency Sessions', null, 1, 60, 'USD', true
where not exists (select 1 from products where name = '1:1 Fluency Sessions')

union all
select (select id from programs where slug = 'one-on-one'),
       '1:1 Pronunciation Sessions', null, 1, 95, 'USD', true
where not exists (select 1 from products where name = '1:1 Pronunciation Sessions')

union all
select (select id from programs where slug = 'one-on-one'),
       'Speaking with Feedback 1:1', null, 1, null, 'USD', true
where not exists (select 1 from products where name = 'Speaking with Feedback 1:1')

union all
select (select id from programs where slug = 'one-on-one'),
       'Group Speaking with Feedback', null, 0, 50, 'USD', true
where not exists (select 1 from products where name = 'Group Speaking with Feedback')

union all
select (select id from programs where slug = 'one-on-one'),
       'Fluency Sessions', 'ILS local clients', 1, null, 'ILS', true
where not exists (select 1 from products where name = 'Fluency Sessions')

-- ── My English Mindset ──────────────────────────────────────
union all
select (select id from programs where slug = 'my-english-mindset'),
       'My English Mindset', null, 0, 49, 'USD', true
where not exists (select 1 from products where name = 'My English Mindset');


-- ─── 3. PLANS ────────────────────────────────────────────────
-- external_id is stored as text (TC item_id).
-- Conflict guard: WHERE NOT EXISTS on (product_id, external_id) or
-- (product_id, name) for non-TC plans.

insert into plans (product_id, name, payment_type, installments_count, amount, currency, payment_rail, external_id, active)

-- ── New Sound Core ──────────────────────────────────────────
select (select id from products where name = 'New Sound Core'),
       'One payment', 'one_time', null, 447, 'USD', 'thrivecart', '174', true
where not exists (select 1 from plans where external_id = '174')

union all
select (select id from products where name = 'New Sound Core'),
       'One payment (2025)', 'one_time', null, 447, 'USD', 'thrivecart', '277', true
where not exists (select 1 from plans where external_id = '277')

union all
select (select id from products where name = 'New Sound Core'),
       '3 payments x $149', 'installment', 3, 149, 'USD', 'thrivecart', '175', true
where not exists (select 1 from plans where external_id = '175')

union all
select (select id from products where name = 'New Sound Core'),
       '3 payments x $149 (2025)', 'installment', 3, 149, 'USD', 'thrivecart', '274', true
where not exists (select 1 from plans where external_id = '274')

union all
select (select id from products where name = 'New Sound Core'),
       '5 payments', 'installment', 5, null, 'USD', 'thrivecart', '201', true
where not exists (select 1 from plans where external_id = '201')

-- ── New Sound Standard ──────────────────────────────────────
union all
select (select id from products where name = 'New Sound Standard'),
       'One payment', 'one_time', null, 697, 'USD', 'thrivecart', '41', true
where not exists (select 1 from plans where external_id = '41')

union all
select (select id from products where name = 'New Sound Standard'),
       'One payment 2025', 'one_time', null, 697, 'USD', 'thrivecart', '217', true
where not exists (select 1 from plans where external_id = '217')

union all
select (select id from products where name = 'New Sound Standard'),
       '3 payments x $97', 'installment', 3, 97, 'USD', 'thrivecart', '206', true
where not exists (select 1 from plans where external_id = '206')

union all
select (select id from products where name = 'New Sound Standard'),
       '5 payments', 'installment', 5, null, 'USD', 'thrivecart', '227', true
where not exists (select 1 from plans where external_id = '227')

union all
select (select id from products where name = 'New Sound Standard'),
       '6 payments', 'installment', 6, null, 'USD', 'thrivecart', '213', true
where not exists (select 1 from plans where external_id = '213')

union all
select (select id from products where name = 'New Sound Standard'),
       '8 payments x $97', 'installment', 8, 97, 'USD', 'thrivecart', '69', true
where not exists (select 1 from plans where external_id = '69')

union all
select (select id from products where name = 'New Sound Standard'),
       '12 payments x $48.5', 'installment', 12, 48.5, 'USD', 'thrivecart', '203', true
where not exists (select 1 from plans where external_id = '203')

union all
select (select id from products where name = 'New Sound Standard'),
       '12 payments x $65', 'installment', 12, 65, 'USD', 'thrivecart', '219', true
where not exists (select 1 from plans where external_id = '219')

union all
select (select id from products where name = 'New Sound Standard'),
       '3 payments x $252 (Spring 2024)', 'installment', 3, null, 'USD', 'thrivecart', '252', true
where not exists (select 1 from plans where external_id = '252')

-- ── New Sound VIP ───────────────────────────────────────────
union all
select (select id from products where name = 'New Sound VIP'),
       'One payment', 'one_time', null, 1697, 'USD', 'thrivecart', '131', true
where not exists (select 1 from plans where external_id = '131')

union all
select (select id from products where name = 'New Sound VIP'),
       '6 payments x $297', 'installment', 6, 297, 'USD', 'thrivecart', '150', true
where not exists (select 1 from plans where external_id = '150')

union all
select (select id from products where name = 'New Sound VIP'),
       '8 payments', 'installment', 8, null, 'USD', 'thrivecart', '221', true
where not exists (select 1 from plans where external_id = '221')

union all
select (select id from products where name = 'New Sound VIP'),
       '10 payments', 'installment', 10, null, 'USD', 'thrivecart', '253', true
where not exists (select 1 from plans where external_id = '253')

union all
select (select id from products where name = 'New Sound VIP'),
       '12 payments', 'installment', 12, null, 'USD', 'thrivecart', '273', true
where not exists (select 1 from plans where external_id = '273')

-- ── New Sound LE Standard ───────────────────────────────────
union all
select (select id from products where name = 'New Sound LE Standard'),
       'One payment', 'one_time', null, 229, 'USD', 'thrivecart', '72', true
where not exists (select 1 from plans where external_id = '72')

union all
select (select id from products where name = 'New Sound LE Standard'),
       '3 payments x $77', 'installment', 3, 77, 'USD', 'thrivecart', '77', true
where not exists (select 1 from plans where external_id = '77')

-- ── New Sound LE VIP ────────────────────────────────────────
union all
select (select id from products where name = 'New Sound LE VIP'),
       'One payment', 'one_time', null, 1029, 'USD', 'thrivecart', '75', true
where not exists (select 1 from plans where external_id = '75')

union all
select (select id from products where name = 'New Sound LE VIP'),
       '6 payments x $179', 'installment', 6, 179, 'USD', 'thrivecart', '78', true
where not exists (select 1 from plans where external_id = '78')

union all
select (select id from products where name = 'New Sound LE VIP'),
       '8 payments', 'installment', 8, null, 'USD', 'thrivecart', '222', true
where not exists (select 1 from plans where external_id = '222')

-- ── New Sound Coaching Pods ─────────────────────────────────
union all
select (select id from products where name = 'New Sound Coaching Pods'),
       'One payment $250', 'one_time', null, 250, 'USD', 'thrivecart', '202', true
where not exists (select 1 from plans where external_id = '202')

union all
select (select id from products where name = 'New Sound Coaching Pods'),
       'One payment $250 (2025)', 'one_time', null, 250, 'USD', 'thrivecart', '275', true
where not exists (select 1 from plans where external_id = '275')

union all
select (select id from products where name = 'New Sound Coaching Pods'),
       '4 payments', 'installment', 4, null, 'USD', 'thrivecart', '276', true
where not exists (select 1 from plans where external_id = '276')

-- ── Beyond Membership ───────────────────────────────────────
union all
select (select id from products where name = 'Beyond Membership'),
       'Monthly $37', 'subscription', null, 37, 'USD', 'thrivecart', '1', true
where not exists (select 1 from plans where external_id = '1')

union all
select (select id from products where name = 'Beyond Membership'),
       'Monthly $29', 'subscription', null, 29, 'USD', 'thrivecart', '268', true
where not exists (select 1 from plans where external_id = '268')

union all
select (select id from products where name = 'Beyond Membership'),
       'Monthly $39', 'subscription', null, 39, 'USD', 'thrivecart', '234', true
where not exists (select 1 from plans where external_id = '234')

union all
select (select id from products where name = 'Beyond Membership'),
       'Semi-annual $185', 'subscription', null, 185, 'USD', 'thrivecart', '254', true
where not exists (select 1 from plans where external_id = '254')

union all
select (select id from products where name = 'Beyond Membership'),
       'Annual $290', 'subscription', null, 290, 'USD', 'thrivecart', '2', true
where not exists (select 1 from plans where external_id = '2')

union all
select (select id from products where name = 'Beyond Membership'),
       'Annual $370', 'subscription', null, 370, 'USD', 'thrivecart', '261', true
where not exists (select 1 from plans where external_id = '261')

union all
select (select id from products where name = 'Beyond Membership'),
       'Monthly FREE trial', 'subscription', null, 0, 'USD', 'thrivecart', '263', true
where not exists (select 1 from plans where external_id = '263')

-- ── Sprint Master ───────────────────────────────────────────
union all
select (select id from products where name = 'Sprint Master'),
       'One payment $97', 'one_time', null, 97, 'USD', 'thrivecart', '40', true
where not exists (select 1 from plans where external_id = '40')

union all
select (select id from products where name = 'Sprint Master'),
       'One payment $87', 'one_time', null, 87, 'USD', 'thrivecart', '182', true
where not exists (select 1 from plans where external_id = '182')

union all
select (select id from products where name = 'Sprint Master'),
       'One payment $77', 'one_time', null, 77, 'USD', 'thrivecart', '187', true
where not exists (select 1 from plans where external_id = '187')

-- ── Grammar Master ──────────────────────────────────────────
union all
select (select id from products where name = 'Grammar Master'),
       'One payment $147', 'one_time', null, 147, 'USD', 'thrivecart', '270', true
where not exists (select 1 from plans where external_id = '270')

union all
select (select id from products where name = 'Grammar Master'),
       '2 payments x $48.5', 'installment', 2, 48.5, 'USD', 'thrivecart', '281', true
where not exists (select 1 from plans where external_id = '281')

-- ── 1:1 Fluency Sessions ────────────────────────────────────
union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x1 $50', 'one_time', null, 50, 'USD', 'thrivecart', '130', true
where not exists (select 1 from plans where external_id = '130')

union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x1 $55', 'one_time', null, 55, 'USD', 'thrivecart', '142', true
where not exists (select 1 from plans where external_id = '142')

union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x1 $60', 'one_time', null, 60, 'USD', 'thrivecart', '236', true
where not exists (select 1 from plans where external_id = '236')

union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x4 $195', 'one_time', null, 195, 'USD', 'thrivecart', '143', true
where not exists (select 1 from plans where external_id = '143')

union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x5 $250', 'one_time', null, 250, 'USD', 'thrivecart', '100', true
where not exists (select 1 from plans where external_id = '100')

union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x5 $300', 'one_time', null, 300, 'USD', 'thrivecart', '195', true
where not exists (select 1 from plans where external_id = '195')

union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x8 $440', 'one_time', null, 440, 'USD', 'thrivecart', '242', true
where not exists (select 1 from plans where external_id = '242')

union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x10 $420', 'one_time', null, 420, 'USD', 'thrivecart', '248', true
where not exists (select 1 from plans where external_id = '248')

union all
select (select id from products where name = '1:1 Fluency Sessions'),
       'x10 $550', 'one_time', null, 550, 'USD', 'thrivecart', '241', true
where not exists (select 1 from plans where external_id = '241')

-- ── 1:1 Pronunciation Sessions ──────────────────────────────
union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x1 $90', 'one_time', null, 90, 'USD', 'thrivecart', '31', true
where not exists (select 1 from plans where external_id = '31')

union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x1 $95', 'one_time', null, 95, 'USD', 'thrivecart', '33', true
where not exists (select 1 from plans where external_id = '33')

union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x1 $115', 'one_time', null, 115, 'USD', 'thrivecart', '196', true
where not exists (select 1 from plans where external_id = '196')

union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x4 $355', 'one_time', null, 355, 'USD', 'thrivecart', '34', true
where not exists (select 1 from plans where external_id = '34')

union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x5 $450', 'one_time', null, 450, 'USD', 'thrivecart', '59', true
where not exists (select 1 from plans where external_id = '59')

union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x5 $400', 'one_time', null, 400, 'USD', 'thrivecart', '282', true
where not exists (select 1 from plans where external_id = '282')

union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x10 $850', 'one_time', null, 850, 'USD', 'thrivecart', '57', true
where not exists (select 1 from plans where external_id = '57')

union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x10 $960', 'one_time', null, 960, 'USD', 'thrivecart', '250', true
where not exists (select 1 from plans where external_id = '250')

union all
select (select id from products where name = '1:1 Pronunciation Sessions'),
       'x12 $1020', 'one_time', null, 1020, 'USD', 'thrivecart', '245', true
where not exists (select 1 from plans where external_id = '245')

-- ── Speaking with Feedback 1:1 ──────────────────────────────
union all
select (select id from products where name = 'Speaking with Feedback 1:1'),
       'x5 $225', 'one_time', null, 225, 'USD', 'thrivecart', '247', true
where not exists (select 1 from plans where external_id = '247')

union all
select (select id from products where name = 'Speaking with Feedback 1:1'),
       'x10 $450', 'one_time', null, 450, 'USD', 'thrivecart', '266', true
where not exists (select 1 from plans where external_id = '266')

-- ── Group Speaking with Feedback ────────────────────────────
union all
select (select id from products where name = 'Group Speaking with Feedback'),
       '4 classes $50', 'one_time', null, 50, 'USD', 'thrivecart', '244', true
where not exists (select 1 from plans where external_id = '244')

-- ── Fluency Sessions (ILS) — non-TC ─────────────────────────
union all
select (select id from products where name = 'Fluency Sessions'),
       'Single session 250₪', 'one_time', null, 250, 'ILS', 'green_invoice', null, true
where not exists (
  select 1 from plans
  where product_id = (select id from products where name = 'Fluency Sessions')
    and name = 'Single session 250₪'
)

union all
select (select id from products where name = 'Fluency Sessions'),
       '5 sessions 1750₪', 'one_time', null, 1750, 'ILS', 'green_invoice', null, true
where not exists (
  select 1 from plans
  where product_id = (select id from products where name = 'Fluency Sessions')
    and name = '5 sessions 1750₪'
)

union all
select (select id from products where name = 'Fluency Sessions'),
       '20 sessions 4500₪', 'one_time', null, 4500, 'ILS', 'green_invoice', null, true
where not exists (
  select 1 from plans
  where product_id = (select id from products where name = 'Fluency Sessions')
    and name = '20 sessions 4500₪'
)

union all
select (select id from products where name = 'Fluency Sessions'),
       'Custom package', 'manual', null, null, 'ILS', 'manual', null, true
where not exists (
  select 1 from plans
  where product_id = (select id from products where name = 'Fluency Sessions')
    and name = 'Custom package'
)

-- ── My English Mindset ──────────────────────────────────────
union all
select (select id from products where name = 'My English Mindset'),
       'One payment $49', 'one_time', null, 49, 'USD', 'thrivecart', '160', true
where not exists (select 1 from plans where external_id = '160')

union all
select (select id from products where name = 'My English Mindset'),
       'Sale $49', 'one_time', null, 49, 'USD', 'thrivecart', '249', true
where not exists (select 1 from plans where external_id = '249');


-- ─── 4. TRANSACTIONS ─────────────────────────────────────────
-- Conflict guard: external_id is not unique in schema, so use
-- WHERE NOT EXISTS on (source, external_id) per row.
-- For rows without external_id (bank/wise by reference), guard on
-- (source, transaction_date, amount, counterparty_name).

-- ── Green Invoice (direction = 'in') ────────────────────────

insert into transactions
  (source, direction, external_id, status, amount, currency, exchange_rate, amount_ils,
   counterparty_name, event_type, transaction_date, category, raw_data)

select 'green_invoice', 'in', '605751', 'unmatched',
       2300, 'ILS', 1, 2300,
       'Meirav Hadas Hadad', 'invoice_receipt', '2026-03-01',
       null,
       '{"מספר המסמך": "605751", "לקוח": "Meirav Hadas Hadad", "מחיר": 2300, "מטבע": "ILS", "שער מטבע": 1, "סוג תנועה": "חשבונית קבלה", "תיאור": "Fluency Sessions"}'::jsonb
where not exists (select 1 from transactions where source = 'green_invoice' and external_id = '605751')

union all
select 'green_invoice', 'in', '605753', 'unmatched',
       5900, 'ILS', 1, 5900,
       'וואן פתרונות טכנולוגיים', 'invoice_receipt', '2026-03-02',
       null,
       '{"מספר המסמך": "605753", "לקוח": "וואן פתרונות טכנולוגיים", "מחיר": 5900, "מטבע": "ILS", "שער מטבע": 1, "סוג תנועה": "חשבונית קבלה", "תיאור": "English training PO 26000062"}'::jsonb
where not exists (select 1 from transactions where source = 'green_invoice' and external_id = '605753')

union all
select 'green_invoice', 'in', '605757', 'unmatched',
       1750, 'ILS', 1, 1750,
       'Guy Zahut', 'invoice_receipt', '2026-03-12',
       null,
       '{"מספר המסמך": "605757", "לקוח": "Guy Zahut", "מחיר": 1750, "מטבע": "ILS", "שער מטבע": 1, "סוג תנועה": "חשבונית קבלה", "תיאור": "5 sessions package 1750 ILS", "אמצעי תשלום": "bit"}'::jsonb
where not exists (select 1 from transactions where source = 'green_invoice' and external_id = '605757')

union all
select 'green_invoice', 'in', '605764', 'unmatched',
       3923.57, 'ILS', 1, 3923.57,
       'Google Ireland', 'invoice_receipt', '2026-03-30',
       'advertising_revenue',
       '{"מספר המסמך": "605764", "לקוח": "Google Ireland", "מחיר": 3923.57, "מטבע": "ILS", "שער מטבע": 1, "סוג תנועה": "חשבונית קבלה", "תיאור": "YouTube advertising revenue"}'::jsonb
where not exists (select 1 from transactions where source = 'green_invoice' and external_id = '605764')

union all
select 'green_invoice', 'in', '605766', 'unmatched',
       513, 'USD', 3.17, 1626.21,
       'כללי מרוכז (PayPal bundle)', 'invoice_receipt', '2026-03-30',
       null,
       '{"מספר המסמך": "605766", "לקוח": "כללי מרוכז (PayPal bundle)", "מחיר": 513, "מטבע": "USD", "שער מטבע": 3.17, "מחיר ILS": 1626.21, "סוג תנועה": "חשבונית קבלה"}'::jsonb
where not exists (select 1 from transactions where source = 'green_invoice' and external_id = '605766')

union all
-- Cancellation — negative amount, direction still 'in' to cancel a prior in
select 'green_invoice', 'in', '802571', 'unmatched',
       -17500, 'ILS', 1, -17500,
       'אלבינו הפקות', 'cancel', '2026-03-27',
       null,
       '{"מספר המסמך": "802571", "לקוח": "אלבינו הפקות", "מחיר": -17500, "מטבע": "ILS", "שער מטבע": 1, "סוג תנועה": "ביטול", "תיאור": "CANCELLATION"}'::jsonb
where not exists (select 1 from transactions where source = 'green_invoice' and external_id = '802571')

union all
select 'green_invoice', 'in', '605759', 'unmatched',
       4500, 'ILS', 1, 4500,
       'Ron Kahat', 'invoice_receipt', '2026-03-18',
       null,
       '{"מספר המסמך": "605759", "לקוח": "Ron Kahat", "מחיר": 4500, "מטבע": "ILS", "שער מטבע": 1, "סוג תנועה": "חשבונית קבלה", "תיאור": "20 Fluency Sessions 4500 ILS", "אמצעי תשלום": "credit card 8882"}'::jsonb
where not exists (select 1 from transactions where source = 'green_invoice' and external_id = '605759')

union all
select 'green_invoice', 'in', '605754', 'unmatched',
       250, 'ILS', 1, 250,
       'חביה קובי', 'invoice_receipt', '2026-03-03',
       null,
       '{"מספר המסמך": "605754", "לקוח": "חביה קובי", "מחיר": 250, "מטבע": "ILS", "שער מטבע": 1, "סוג תנועה": "חשבונית קבלה", "תיאור": "Single Fluency Session 250 ILS", "אמצעי תשלום": "credit card 8649"}'::jsonb
where not exists (select 1 from transactions where source = 'green_invoice' and external_id = '605754');

-- ── Mizrachi Bank ────────────────────────────────────────────

insert into transactions
  (source, direction, status, amount, currency, amount_ils,
   counterparty_name, counterparty_account, reference, event_type, transaction_date, raw_data)

select 'bank', 'out', 'unmatched',
       -610.53, 'ILS', -610.53,
       'ויזה מקס 8292', null, null, 'bank_debit', '2026-03-15',
       '{"source": "mizrachi_bank", "date": "2026-03-15", "amount": -610.53, "currency": "ILS", "counterparty": "ויזה מקס 8292", "event_type": "bank_debit"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'bank' and transaction_date = '2026-03-15'
    and counterparty_name = 'ויזה מקס 8292' and amount = -610.53
)

union all
select 'bank', 'in', 'unmatched',
       3923.57, 'ILS', 3923.57,
       'גוגל אירלנד', '22-1-620107042', '000000000000GG104BM0SA', 'bank_credit', '2026-03-22',
       '{"source": "mizrachi_bank", "date": "2026-03-22", "amount": 3923.57, "currency": "ILS", "counterparty": "גוגל אירלנד", "account": "22-1-620107042", "reference": "000000000000GG104BM0SA", "event_type": "bank_credit"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'bank' and transaction_date = '2026-03-22'
    and counterparty_name = 'גוגל אירלנד' and amount = 3923.57
)

union all
select 'bank', 'out', 'unmatched',
       -232, 'ILS', -232,
       'מס הכנסה', null, null, 'bank_debit', '2026-03-27',
       '{"source": "mizrachi_bank", "date": "2026-03-27", "amount": -232, "currency": "ILS", "counterparty": "מס הכנסה", "event_type": "bank_debit"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'bank' and transaction_date = '2026-03-27'
    and counterparty_name = 'מס הכנסה' and amount = -232
)

union all
select 'bank', 'in', 'unmatched',
       1050, 'ILS', 1050,
       'Discount Bank', null, null, 'bank_credit', '2026-03-31',
       '{"source": "mizrachi_bank", "date": "2026-03-31", "amount": 1050, "currency": "ILS", "counterparty": "Discount Bank", "event_type": "bank_credit"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'bank' and transaction_date = '2026-03-31'
    and counterparty_name = 'Discount Bank' and amount = 1050
)

union all
select 'bank', 'out', 'unmatched',
       -3374.8, 'ILS', -3374.8,
       'פולק נטלי', null, 'teaching march 40235', 'bank_debit', '2026-04-07',
       '{"source": "mizrachi_bank", "date": "2026-04-07", "amount": -3374.8, "currency": "ILS", "counterparty": "פולק נטלי", "reference": "teaching march 40235", "event_type": "bank_debit"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'bank' and transaction_date = '2026-04-07'
    and counterparty_name = 'פולק נטלי' and amount = -3374.8
);

-- ── Wise ─────────────────────────────────────────────────────

insert into transactions
  (source, direction, external_id, status, amount, currency,
   counterparty_name, reference, event_type, transaction_date, raw_data)

select 'wise', 'out', 'TRANSFER-1933282284', 'unmatched',
       50, 'USD',
       'Cassandra Celine Ferry Blyth', '01 video editing', 'transfer_out', '2026-01-22',
       '{"ID": "TRANSFER-1933282284", "Status": "OUTGOING_PAYMENT_SENT", "Direction": "OUT", "Source name": "HSos", "Target name": "Cassandra Celine Ferry Blyth", "Source amount (after fees)": 50, "Source currency": "USD", "Target amount": 2952, "Target currency": "PHP", "Reference": "01 video editing", "Source fee amount": 0.23, "Source fee currency": "USD"}'::jsonb
where not exists (select 1 from transactions where source = 'wise' and external_id = 'TRANSFER-1933282284')

union all
select 'wise', 'out', 'TRANSFER-1918168218', 'unmatched',
       400, 'USD',
       'HodayaA@cpa.co.il', '21431 audit 2 2024', 'transfer_out', '2026-01-13',
       '{"ID": "TRANSFER-1918168218", "Status": "OUTGOING_PAYMENT_SENT", "Direction": "OUT", "Source name": "HSos", "Target name": "HodayaA@cpa.co.il", "Source amount (after fees)": 400, "Source currency": "USD", "Target amount": 400, "Target currency": "USD", "Reference": "21431 audit 2 2024", "Source fee amount": 8.54, "Source fee currency": "USD"}'::jsonb
where not exists (select 1 from transactions where source = 'wise' and external_id = 'TRANSFER-1918168218')

union all
select 'wise', 'in', 'TRANSFER-1916644520', 'unmatched',
       1000, 'USD',
       'HADAR SHEMESH', 'HADAR SHEM', 'transfer_in', '2026-01-12',
       '{"ID": "TRANSFER-1916644520", "Status": "FUNDS_CONVERTED", "Direction": "IN", "Source name": "HADAR SHEMESH", "Target name": "HSos Wise", "Source amount (after fees)": 1000, "Source currency": "USD", "Target amount": 1000, "Target currency": "USD", "Reference": "HADAR SHEM"}'::jsonb
where not exists (select 1 from transactions where source = 'wise' and external_id = 'TRANSFER-1916644520')

union all
select 'wise', 'out', 'TRANSFER-1916593650', 'unmatched',
       20, 'EUR',
       'Laura Daniela Orozco Urbina', 'test task 1003', 'transfer_out', '2026-01-12',
       '{"ID": "TRANSFER-1916593650", "Status": "OUTGOING_PAYMENT_SENT", "Direction": "OUT", "Source name": "HSos", "Target name": "Laura Daniela Orozco Urbina", "Source amount (after fees)": 20, "Source currency": "EUR", "Target amount": 20, "Target currency": "EUR", "Reference": "test task 1003"}'::jsonb
where not exists (select 1 from transactions where source = 'wise' and external_id = 'TRANSFER-1916593650');

-- ── ThriveCart ───────────────────────────────────────────────

insert into transactions
  (source, direction, external_id, status, amount, currency,
   counterparty_name, event_type, transaction_date, installment_index,
   plan_id, raw_data)

-- order 37432178 — recur_fail installment 3 (invoice_id 004217834-3)
select 'thrivecart', 'in', '37432178', 'unmatched',
       297, 'USD',
       'Esther Chua', 'recur_fail', '2026-02-21', 3,
       (select id from plans where external_id = '150'),
       '{"event": "recur_fail", "order_id": "37432178", "invoice_id": "004217834-3", "item_name": "New Sound VIP", "item_plan_name": "6 payments x $297", "order_currency": "USD", "item_amount": 297, "order_processor": "stripe", "address_country": "SG", "email": "esther@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '37432178'
    and event_type = 'recur_fail' and installment_index = 3
)

union all
-- order 40423210 — purchase Sprint Master $97
select 'thrivecart', 'in', '40423210', 'unmatched',
       97, 'USD',
       'Manuel Eletto', 'purchase', '2026-03-02', null,
       (select id from plans where external_id = '40'),
       '{"event": "purchase", "order_id": "40423210", "invoice_id": "004220555", "item_name": "Sprint Master", "item_plan_name": "One payment $97", "order_currency": "USD", "item_amount": 97, "order_processor": "paypal", "address_country": "IT", "email": "manuel@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '40423210'
    and event_type = 'purchase'
)

union all
-- order 40423210 — bump Sprint Master 2.0 $48 (same order, separate row)
select 'thrivecart', 'in', '40423210', 'unmatched',
       48, 'USD',
       'Manuel Eletto', 'bump', '2026-03-02', null,
       null,
       '{"event": "bump", "order_id": "40423210", "invoice_id": "004220555", "item_name": "Sprint Master 2.0", "item_plan_name": "Order bump", "order_currency": "USD", "item_amount": 48, "order_processor": "paypal", "address_country": "IT", "email": "manuel@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '40423210'
    and event_type = 'bump'
)

union all
-- order 40626660 — Beyond Monthly $39 purchase
select 'thrivecart', 'in', '40626660', 'unmatched',
       39, 'USD',
       'Cecilia Ravetti', 'purchase', '2026-03-15', null,
       (select id from plans where external_id = '234'),
       '{"event": "purchase", "order_id": "40626660", "invoice_id": "004221830", "item_name": "Beyond Membership", "item_plan_name": "Monthly $39", "order_currency": "USD", "item_amount": 39, "order_processor": "stripe", "address_country": "BR", "email": "cecilia@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '40626660'
    and event_type = 'purchase'
)

union all
-- order 14538101 — Beyond recur_success $29 installment 44 (invoice_id 001453810-44)
select 'thrivecart', 'in', '14538101', 'unmatched',
       29, 'USD',
       'Johanna Chaparro', 'recur_success', '2026-03-15', 44,
       (select id from plans where external_id = '268'),
       '{"event": "recur_success", "order_id": "14538101", "invoice_id": "001453810-44", "item_name": "Beyond Membership", "item_plan_name": "Monthly $29", "order_currency": "USD", "item_amount": 29, "order_processor": "stripe", "address_country": "AU", "email": "johanna@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '14538101'
    and installment_index = 44
)

union all
-- order 37302164 — New Sound Standard 8p recur_success installment 6 (invoice_id 003730216-6)
select 'thrivecart', 'in', '37302164', 'unmatched',
       97, 'USD',
       'Fabiola Uribe Plata', 'recur_success', '2026-03-18', 6,
       (select id from plans where external_id = '69'),
       '{"event": "recur_success", "order_id": "37302164", "invoice_id": "003730216-6", "item_name": "New Sound Standard", "item_plan_name": "8 payments x $97", "order_currency": "USD", "item_amount": 97, "order_processor": "stripe", "address_country": "US", "email": "fabiola@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '37302164'
    and installment_index = 6
)

union all
-- order 40887861 — Group 4 classes $50 purchase
select 'thrivecart', 'in', '40887861', 'unmatched',
       50, 'USD',
       'Soraya Carvajal', 'purchase', '2026-04-01', null,
       (select id from plans where external_id = '244'),
       '{"event": "purchase", "order_id": "40887861", "invoice_id": "004222561", "item_name": "Group Speaking with Feedback", "item_plan_name": "4 classes $50", "order_currency": "USD", "item_amount": 50, "order_processor": "stripe", "address_country": "ES", "email": "soraya@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '40887861'
    and event_type = 'purchase'
)

union all
-- order 40974784 — New Sound purchase $497 with coupon (no external_id plan match — coupon price)
select 'thrivecart', 'in', '40974784', 'unmatched',
       497, 'USD',
       'Miguel Chacin', 'purchase', '2026-04-07', null,
       null,
       '{"event": "purchase", "order_id": "40974784", "invoice_id": "004223112", "item_name": "New Sound", "item_plan_name": "One payment", "order_currency": "USD", "item_amount": 497, "coupon": "NS11697D200", "order_processor": "stripe", "address_country": "CR", "email": "miguel@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '40974784'
    and event_type = 'purchase'
)

union all
-- order 40978725 — Grammar Master $147 purchase
select 'thrivecart', 'in', '40978725', 'unmatched',
       147, 'USD',
       'Adriana Zabalaga', 'purchase', '2026-04-07', null,
       (select id from plans where external_id = '270'),
       '{"event": "purchase", "order_id": "40978725", "invoice_id": "004223198", "item_name": "Grammar Master", "item_plan_name": "One payment $147", "order_currency": "USD", "item_amount": 147, "order_processor": "stripe", "address_country": "CA", "email": "adriana@example.com"}'::jsonb
where not exists (
  select 1 from transactions
  where source = 'thrivecart' and external_id = '40978725'
    and event_type = 'purchase'
);


-- ─── Expected counts after seed ──────────────────────────────
-- programs:     7
-- products:    ~19
-- plans:       ~63
-- transactions: ~25
