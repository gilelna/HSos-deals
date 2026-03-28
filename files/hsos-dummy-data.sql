-- HSos Dummy Data Seed Script
-- Generated: 2026-03-27 00:44:53 UTC
-- Requires: run files/hsos-schema.sql first
-- Contains: 30 clients, 17 vendors, 8 products, 34 rates, 20 deals, 48 sessions, 90 vendor_hours, 30 payments, 13 invoices, 16 documents, 12 reminders

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.clients') IS NULL
     OR to_regclass('public.vendors') IS NULL
     OR to_regclass('public.deals') IS NULL THEN
    RAISE EXCEPTION 'Schema missing. Run files/hsos-schema.sql before this seed script.';
  END IF;
END $$;

-- Clients
CREATE TEMP TABLE seed_clients (
  client_key text PRIMARY KEY,
  id uuid NOT NULL,
  customer_id text,
  full_name text,
  email text,
  phone text,
  client_kind text,
  company text,
  source text,
  notes text,
  active boolean,
  created_at timestamptz
) ON COMMIT DROP;
INSERT INTO seed_clients (client_key, id, customer_id, full_name, email, phone, client_kind, company, source, notes, active, created_at) VALUES
('c01', gen_random_uuid(), 'AC-12001', 'Noa Levi', 'noa.levi@gmail.com', '+972-50-859-5506', 'private', NULL, 'website', NULL, true, '2025-09-25 10:00:00+00'),
('c02', gen_random_uuid(), 'AC-12002', 'Daniel Cohen', 'daniel.cohen@outlook.com', '+972-58-204-9935', 'private', NULL, 'referral', 'Prefers communication in Hebrew', true, '2025-09-30 11:00:00+00'),
('c03', gen_random_uuid(), 'AC-12003', 'Yael Mizrahi', 'yael.mizrahi@walla.co.il', '+972-50-130-2535', 'private', NULL, 'website', NULL, true, '2025-10-05 12:00:00+00'),
('c04', gen_random_uuid(), 'AC-12004', 'Amit Peretz', 'amit.peretz@icloud.com', '+972-55-127-4257', 'private', NULL, 'event', 'Requested bi-weekly cadence', true, '2025-10-10 13:00:00+00'),
('c05', gen_random_uuid(), 'AC-12005', 'Shira Ben David', 'shira.bendavid@outlook.com', '+972-54-703-5557', 'private', NULL, 'referral', NULL, true, '2025-10-15 14:00:00+00'),
('c06', gen_random_uuid(), 'AC-12006', 'Eitan Amar', 'eitan.amar@walla.co.il', '+972-53-384-3547', 'private', NULL, 'website', NULL, true, '2025-10-20 15:00:00+00'),
('c07', gen_random_uuid(), 'AC-12007', 'Maya Shalev', 'maya.shalev@gmail.com', '+972-50-489-2584', 'private', NULL, 'linkedin', NULL, false, '2025-10-25 09:00:00+00'),
('c08', gen_random_uuid(), 'AC-12008', 'Lior Katz', 'lior.katz@icloud.com', '+972-53-926-1711', 'private', NULL, 'partner', 'Prefers communication in Hebrew', true, '2025-10-30 10:00:00+00'),
('c09', gen_random_uuid(), 'AC-12009', 'Tamar Avraham', 'tamar.avraham@gmail.com', '+972-54-180-5803', 'private', NULL, 'event', NULL, true, '2025-11-04 11:00:00+00'),
('c10', gen_random_uuid(), 'AC-12010', 'Omer Haddad', 'omer.haddad@icloud.com', '+972-52-821-2139', 'private', NULL, 'referral', NULL, true, '2025-11-09 12:00:00+00'),
('c11', gen_random_uuid(), 'AC-12011', 'Roni Sasson', 'roni.sasson@outlook.com', '+972-53-181-4814', 'private', NULL, 'referral', 'Requested bi-weekly cadence', true, '2025-11-14 13:00:00+00'),
('c12', gen_random_uuid(), 'AC-12012', 'Gal Biton', 'gal.biton@proton.me', '+972-54-750-6977', 'private', NULL, 'website', NULL, true, '2025-11-19 14:00:00+00'),
('c13', gen_random_uuid(), 'AC-12013', 'Sivan Naim', 'sivan.naim@proton.me', '+972-52-786-5374', 'private', NULL, 'referral', 'Prefers communication in Hebrew', true, '2025-11-24 15:00:00+00'),
('c14', gen_random_uuid(), 'AC-12014', 'Yarden Bar', 'yarden.bar@outlook.com', '+972-55-846-5010', 'private', NULL, 'website', 'Requested bi-weekly cadence', true, '2025-11-29 09:00:00+00'),
('c15', gen_random_uuid(), 'AC-12015', 'Neta Golan', 'neta.golan@walla.co.il', '+972-53-755-4598', 'private', NULL, 'linkedin', NULL, true, '2025-12-04 10:00:00+00'),
('c16', gen_random_uuid(), 'AC-12016', 'Itay Sharabi', 'itay.sharabi@outlook.com', '+972-50-924-6168', 'private', NULL, 'partner', NULL, true, '2025-12-09 11:00:00+00'),
('c17', gen_random_uuid(), 'AC-12017', 'Adi Regev', 'adi.regev@gmail.com', '+972-52-680-6155', 'private', NULL, 'website', NULL, false, '2025-12-14 12:00:00+00'),
('c18', gen_random_uuid(), 'AC-12018', 'Eliav Rosen', 'eliav.rosen@walla.co.il', '+972-54-758-8517', 'private', NULL, 'website', NULL, true, '2025-12-19 13:00:00+00'),
('c19', gen_random_uuid(), 'AC-12019', 'Michal Fridman', 'michal.fridman@outlook.com', '+972-52-862-9830', 'private', NULL, 'linkedin', NULL, true, '2025-12-24 14:00:00+00'),
('c20', gen_random_uuid(), 'AC-12020', 'Yuval Dahan', 'yuval.dahan@icloud.com', '+972-54-697-7543', 'private', NULL, 'linkedin', NULL, true, '2025-12-29 15:00:00+00'),
('c21', gen_random_uuid(), 'TC-12021', 'Rachel Stein', 'rachel.stein@novaedge.com', '+972-52-621-9085', 'corporate', 'NovaEdge Systems', 'referral', NULL, true, '2025-10-12 11:30:00+00'),
('c22', gen_random_uuid(), 'TC-12022', 'Ido Lavi', 'ido.lavi@kerentech.io', '+972-50-256-3621', 'corporate', 'KerenTech Labs', 'partner', NULL, true, '2025-10-23 12:30:00+00'),
('c23', gen_random_uuid(), 'TC-12023', 'Hila Mor', 'hila.mor@bluecedar.co', '+972-50-494-7252', 'corporate', 'Blue Cedar Holdings', 'event', 'Legal review required before kickoff', false, '2025-11-03 13:30:00+00'),
('c24', gen_random_uuid(), 'TC-12024', 'Nir Asulin', 'nir.asulin@orionmed.com', '+972-55-357-1188', 'corporate', 'Orion Medical Group', 'referral', NULL, true, '2025-11-14 10:30:00+00'),
('c25', gen_random_uuid(), 'TC-12025', 'Dana Weiss', 'dana.weiss@harborpeak.net', '+972-53-887-6573', 'corporate', 'HarborPeak Consulting', 'referral', 'Needs quarterly reporting', true, '2025-11-25 11:30:00+00'),
('c26', gen_random_uuid(), 'TC-12026', 'Erez Berkovitz', 'erez.berkovitz@talpiot.vc', '+972-54-261-8433', 'corporate', 'Talpiot Ventures', 'referral', 'Needs quarterly reporting', true, '2025-12-06 12:30:00+00'),
('c27', gen_random_uuid(), 'TC-12027', 'Moran Dayan', 'moran.dayan@urbangrid.design', '+972-55-880-3927', 'corporate', 'UrbanGrid Design', 'event', NULL, true, '2025-12-17 13:30:00+00'),
('c28', gen_random_uuid(), 'TC-12028', 'Omri Bashan', 'omri.bashan@carmellogistics.com', '+972-58-405-9317', 'corporate', 'Carmel Logistics', 'event', NULL, true, '2025-12-28 10:30:00+00'),
('c29', gen_random_uuid(), 'TC-12029', 'Tali Yosef', 'tali.yosef@axisretail.co', '+972-52-482-3646', 'corporate', 'Axis Retail Partners', 'event', NULL, true, '2026-01-08 11:30:00+00'),
('c30', gen_random_uuid(), 'TC-12030', 'Gil Sharir', 'gil.sharir@lighthouseedu.org', '+972-50-713-6310', 'corporate', 'Lighthouse Education', 'partner', NULL, true, '2026-01-19 12:30:00+00');
INSERT INTO clients (id, customer_id, full_name, email, phone, client_kind, company, source, notes, active, created_at)
SELECT id, customer_id, full_name, email, phone, client_kind, company, source, notes, active, created_at
FROM seed_clients;

-- Vendors
CREATE TEMP TABLE seed_vendors (
  vendor_key text PRIMARY KEY,
  id uuid NOT NULL,
  full_name text,
  nickname text,
  email text,
  phone text,
  vendor_type vendor_type,
  payment_method text,
  payment_id text,
  iban text,
  preferred_currency text,
  contract_url text,
  active boolean,
  notes text,
  created_at timestamptz
) ON COMMIT DROP;
INSERT INTO seed_vendors (vendor_key, id, full_name, nickname, email, phone, vendor_type, payment_method, payment_id, iban, preferred_currency, contract_url, active, notes, created_at) VALUES
('v01', gen_random_uuid(), 'Maya Levi', 'Maya', 'maya.levi@hsos.co', '+972-50-211-3401', 'coach', 'iban', 'IL620800000010100000001', 'IL62-0800-0000-1010-0000-001', 'EUR', 'https://drive.google.com/file/d/1MayaLeviContract/view', true, 'Exec coaching focus', '2025-09-15 09:00:00+00'),
('v02', gen_random_uuid(), 'Jonathan Reed', 'Jon', 'jonathan.reed@hsos.co', '+972-52-443-9902', 'coach', 'paypal', 'jon.reed.coach@paypal.com', NULL, 'USD', 'https://drive.google.com/file/d/1JonReedContract/view', true, 'Leadership transitions', '2025-09-21 09:00:00+00'),
('v03', gen_random_uuid(), 'Shani Katz', 'Shani', 'shani.katz@hsos.co', '+972-54-322-7703', 'coach', 'wise', 'wise-shani-katz-8821', NULL, 'EUR', 'https://drive.google.com/file/d/1ShaniKatzContract/view', true, NULL, '2025-09-27 09:00:00+00'),
('v04', gen_random_uuid(), 'Eyal Mor', 'Eyal', 'eyal.mor@hsos.co', '+972-58-765-1204', 'coach', 'iban', 'IL170120000045670000004', 'IL17-0120-0000-4567-0000-004', 'ILS', 'https://drive.google.com/file/d/1EyalMorContract/view', true, 'Hebrew speaking clients', '2025-10-03 09:00:00+00'),
('v05', gen_random_uuid(), 'Ariella Bloom', 'Ari', 'ariella.bloom@hsos.co', '+972-53-118-5605', 'coach', 'wise', 'wise-ari-bloom-5510', NULL, 'EUR', 'https://drive.google.com/file/d/1AriBloomContract/view', true, NULL, '2025-10-09 09:00:00+00'),
('v06', gen_random_uuid(), 'Liam Porter', 'Liam', 'liam.porter@hsos.co', '+972-50-778-4416', 'contractor', 'paypal', 'liam.design@paypal.com', NULL, 'EUR', 'https://drive.google.com/file/d/1LiamPorterContract/view', true, 'Design contractor', '2025-10-15 09:00:00+00'),
('v07', gen_random_uuid(), 'Yaara Ben Ami', 'Yaara', 'yaara.benami@hsos.co', '+972-52-889-2307', 'contractor', 'iban', 'IL030200000099100000007', 'IL03-0200-0000-9910-0000-007', 'EUR', 'https://drive.google.com/file/d/1YaaraContract/view', true, NULL, '2025-10-21 09:00:00+00'),
('v08', gen_random_uuid(), 'Tomer Weiss', 'Tomer', 'tomer.weiss@hsos.co', '+972-54-451-1308', 'contractor', 'wise', 'wise-tomer-weiss-4412', NULL, 'USD', 'https://drive.google.com/file/d/1TomerContract/view', true, 'Editing and copy', '2025-10-27 09:00:00+00'),
('v09', gen_random_uuid(), 'Nina Calder', 'Nina', 'nina.calder@hsos.co', '+972-58-990-2209', 'contractor', 'iban', 'IL770100000034560000009', 'IL77-0100-0000-3456-0000-009', 'EUR', 'https://drive.google.com/file/d/1NinaCalderContract/view', true, NULL, '2025-11-02 09:00:00+00'),
('v10', gen_random_uuid(), 'Hadar Cohen', 'Hadar', 'hadar.cohen@hsos.co', '+972-50-501-4010', 'team_member', 'iban', 'IL060900000021210000010', 'IL06-0900-0000-2121-0000-010', 'EUR', 'https://drive.google.com/file/d/1HadarContract/view', true, 'Ops support', '2025-11-08 09:00:00+00'),
('v11', gen_random_uuid(), 'Ben Solomon', 'Ben', 'ben.solomon@hsos.co', '+972-52-602-1111', 'team_member', 'paypal', 'ben.solomon.team@paypal.com', NULL, 'EUR', 'https://drive.google.com/file/d/1BenSolomonContract/view', true, NULL, '2025-11-14 09:00:00+00'),
('v12', gen_random_uuid(), 'Keren Shvili', 'Keren', 'keren.shvili@hsos.co', '+972-53-420-1212', 'team_member', 'wise', 'wise-keren-shvili-9021', NULL, 'EUR', 'https://drive.google.com/file/d/1KerenContract/view', true, 'Client success', '2025-11-20 09:00:00+00'),
('v13', gen_random_uuid(), 'Dvir Lapid', 'Dvir', 'dvir.lapid@hsos.co', '+972-54-603-1313', 'team_member', 'iban', 'IL220700000099990000013', 'IL22-0700-0000-9999-0000-013', 'EUR', 'https://drive.google.com/file/d/1DvirContract/view', true, NULL, '2025-11-26 09:00:00+00'),
('v14', gen_random_uuid(), 'Sophie Grant', 'Sophie', 'sophie.grant@hsos.co', '+972-58-604-1414', 'team_member', 'paypal', 'sophie.ops@paypal.com', NULL, 'USD', 'https://drive.google.com/file/d/1SophieGrantContract/view', true, NULL, '2025-12-02 09:00:00+00'),
('v15', gen_random_uuid(), 'Lihi Azulay', 'Lihi', 'lihi.azulay@hsos.co', '+972-50-605-1515', 'team_member', 'iban', 'IL880500000087650000015', 'IL88-0500-0000-8765-0000-015', 'EUR', 'https://drive.google.com/file/d/1LihiContract/view', true, 'Back-office admin', '2025-12-08 09:00:00+00'),
('v16', gen_random_uuid(), 'Omri Feld', 'Omri', 'omri.feld@hsos.co', '+972-52-606-1616', 'team_member', 'wise', 'wise-omri-feld-1616', NULL, 'EUR', 'https://drive.google.com/file/d/1OmriContract/view', true, NULL, '2025-12-14 09:00:00+00'),
('v17', gen_random_uuid(), 'Naomi Brook', 'Naomi', 'naomi.brook@hsos.co', '+972-54-607-1717', 'team_member', 'iban', 'IL450400000011220000017', 'IL45-0400-0000-1122-0000-017', 'EUR', 'https://drive.google.com/file/d/1NaomiBrookContract/view', true, NULL, '2025-12-20 09:00:00+00');
INSERT INTO vendors (id, full_name, nickname, email, phone, vendor_type, payment_method, payment_id, iban, preferred_currency, contract_url, active, notes, created_at)
SELECT id, full_name, nickname, email, phone, vendor_type, payment_method, payment_id, iban, preferred_currency, contract_url, active, notes, created_at
FROM seed_vendors;

-- Products
CREATE TEMP TABLE seed_products (
  product_key text PRIMARY KEY,
  id uuid NOT NULL,
  name text,
  type product_type,
  base_price numeric(10,2),
  currency text,
  units text,
  notes text,
  active boolean,
  payment_links jsonb,
  created_at timestamptz
) ON COMMIT DROP;
INSERT INTO seed_products (product_key, id, name, type, base_price, currency, units, notes, active, payment_links, created_at) VALUES
('p01', gen_random_uuid(), 'Executive Coaching Package', 'package', 3600.00, 'EUR', 'sessions', '12-session executive coaching track', true, '{"stripe":"https://buy.stripe.com/test_exec_coach_12","checkout":"https://pay.hsos.co/exec-coach"}'::jsonb, '2025-09-20 10:00:00+00'),
('p02', gen_random_uuid(), '1:1 Consulting Session', 'session', 250.00, 'EUR', 'hours', 'Single 90-minute consulting session', true, '{"stripe":"https://buy.stripe.com/test_consult_1x1","checkout":"https://pay.hsos.co/consulting-1x1"}'::jsonb, '2025-09-29 10:00:00+00'),
('p03', gen_random_uuid(), 'Group Workshop', 'workshop', 1200.00, 'EUR', 'project', 'Half-day facilitated workshop', true, '{"stripe":"https://buy.stripe.com/test_group_workshop","checkout":"https://pay.hsos.co/workshop"}'::jsonb, '2025-10-08 10:00:00+00'),
('p04', gen_random_uuid(), 'Career Transition Package', 'package', 2400.00, 'EUR', 'sessions', '8-session transition support', true, '{"stripe":"https://buy.stripe.com/test_career_transition","checkout":"https://pay.hsos.co/career-transition"}'::jsonb, '2025-10-17 10:00:00+00'),
('p05', gen_random_uuid(), 'Leadership Development Program', 'package', 6000.00, 'EUR', 'sessions', '20-session enterprise leadership program', true, '{"stripe":"https://buy.stripe.com/test_leadership_program","checkout":"https://pay.hsos.co/leadership"}'::jsonb, '2025-10-26 10:00:00+00'),
('p06', gen_random_uuid(), 'Team Coaching Session', 'session', 400.00, 'EUR', 'hours', 'Team alignment coaching', true, '{"stripe":"https://buy.stripe.com/test_team_coaching","checkout":"https://pay.hsos.co/team-coaching"}'::jsonb, '2025-11-04 10:00:00+00'),
('p07', gen_random_uuid(), 'Assessment & Strategy Session', 'session', 600.00, 'USD', 'sessions', 'Two-session strategic assessment', true, '{"stripe":"https://buy.stripe.com/test_assessment_strategy","checkout":"https://pay.hsos.co/assessment"}'::jsonb, '2025-11-13 10:00:00+00'),
('p08', gen_random_uuid(), 'Custom Consulting Project', 'custom', 5000.00, 'USD', 'project', 'Scoped advisory engagement', true, '{"stripe":"https://buy.stripe.com/test_custom_project","checkout":"https://pay.hsos.co/custom-consulting"}'::jsonb, '2025-11-22 10:00:00+00');
INSERT INTO products (id, name, type, base_price, currency, units, notes, active, payment_links, created_at)
SELECT id, name, type, base_price, currency, units, notes, active, payment_links, created_at
FROM seed_products;

-- Rates
INSERT INTO rates (id, vendor_id, session_type, rate, currency, effective_date, notes, created_at)
SELECT gen_random_uuid(), v.id, r.session_type::session_type, r.rate, r.currency, r.effective_date::date, r.notes, r.created_at::timestamptz
FROM (
  VALUES
  ('v01', 'coaching', 150.00, 'EUR', '2025-10-01', NULL, '2025-10-02 09:00:00+00'),
  ('v01', 'consulting', 165.00, 'EUR', '2025-12-01', NULL, '2025-12-02 09:00:00+00'),
  ('v01', 'editing', 95.00, 'EUR', '2026-01-15', NULL, '2026-01-16 09:00:00+00'),
  ('v02', 'coaching', 180.00, 'USD', '2025-11-10', NULL, '2025-11-11 09:00:00+00'),
  ('v02', 'consulting', 190.00, 'USD', '2026-01-05', NULL, '2026-01-06 09:00:00+00'),
  ('v02', 'design', 120.00, 'USD', '2026-02-01', NULL, '2026-02-02 09:00:00+00'),
  ('v03', 'coaching', 145.00, 'EUR', '2025-10-20', NULL, '2025-10-21 09:00:00+00'),
  ('v03', 'consulting', 155.00, 'EUR', '2025-12-20', NULL, '2025-12-21 09:00:00+00'),
  ('v03', 'editing', 90.00, 'EUR', '2026-02-10', NULL, '2026-02-11 09:00:00+00'),
  ('v03', 'design', 110.00, 'EUR', '2026-03-01', NULL, '2026-03-02 09:00:00+00'),
  ('v04', 'coaching', 155.00, 'ILS', '2025-09-30', NULL, '2025-10-01 09:00:00+00'),
  ('v04', 'consulting', 170.00, 'ILS', '2026-01-10', NULL, '2026-01-11 09:00:00+00'),
  ('v04', 'admin', 95.00, 'ILS', '2026-02-12', NULL, '2026-02-13 09:00:00+00'),
  ('v05', 'coaching', 160.00, 'EUR', '2025-10-15', NULL, '2025-10-16 09:00:00+00'),
  ('v05', 'consulting', 175.00, 'EUR', '2026-01-18', NULL, '2026-01-19 09:00:00+00'),
  ('v06', 'design', 105.00, 'EUR', '2025-10-05', NULL, '2025-10-06 09:00:00+00'),
  ('v06', 'editing', 95.00, 'EUR', '2026-02-05', NULL, '2026-02-06 09:00:00+00'),
  ('v07', 'admin', 75.00, 'EUR', '2025-11-01', NULL, '2025-11-02 09:00:00+00'),
  ('v07', 'editing', 85.00, 'EUR', '2026-01-20', NULL, '2026-01-21 09:00:00+00'),
  ('v08', 'editing', 125.00, 'USD', '2025-12-01', NULL, '2025-12-02 09:00:00+00'),
  ('v09', 'design', 115.00, 'EUR', '2025-10-25', NULL, '2025-10-26 09:00:00+00'),
  ('v09', 'admin', 80.00, 'EUR', '2026-02-15', NULL, '2026-02-16 09:00:00+00'),
  ('v10', 'admin', 70.00, 'EUR', '2025-11-15', NULL, '2025-11-16 09:00:00+00'),
  ('v10', 'consulting', 105.00, 'EUR', '2026-02-01', NULL, '2026-02-02 09:00:00+00'),
  ('v11', 'admin', 68.00, 'EUR', '2025-12-10', NULL, '2025-12-11 09:00:00+00'),
  ('v12', 'coaching', 95.00, 'EUR', '2026-01-01', NULL, '2026-01-02 09:00:00+00'),
  ('v12', 'admin', 72.00, 'EUR', '2026-02-14', NULL, '2026-02-15 09:00:00+00'),
  ('v13', 'consulting', 110.00, 'EUR', '2025-11-20', NULL, '2025-11-21 09:00:00+00'),
  ('v14', 'admin', 85.00, 'USD', '2025-10-18', NULL, '2025-10-19 09:00:00+00'),
  ('v14', 'coaching', 120.00, 'USD', '2026-02-09', NULL, '2026-02-10 09:00:00+00'),
  ('v15', 'admin', 74.00, 'EUR', '2025-12-28', NULL, '2025-12-29 09:00:00+00'),
  ('v16', 'consulting', 102.00, 'EUR', '2025-11-05', NULL, '2025-11-06 09:00:00+00'),
  ('v16', 'admin', 76.00, 'EUR', '2026-03-02', NULL, '2026-03-03 09:00:00+00'),
  ('v17', 'admin', 78.00, 'EUR', '2026-01-12', NULL, '2026-01-13 09:00:00+00')
) AS r(vendor_key, session_type, rate, currency, effective_date, notes, created_at)
JOIN seed_vendors v ON v.vendor_key = r.vendor_key;

-- Deals
CREATE TEMP TABLE seed_deals (
  deal_key text PRIMARY KEY,
  id uuid NOT NULL,
  client_key text,
  primary_vendor_key text,
  owner_vendor_key text,
  product_key text,
  price numeric(10,2),
  currency text,
  vat_pct numeric(5,2),
  vat_mode vat_mode,
  discount text,
  sales_status sales_status,
  billing_status billing_status,
  payment_processor payment_processor,
  gi_client_id text,
  gi_invoice_series text,
  stripe_customer_id text,
  stripe_payment_link text,
  wise_iban text,
  wise_bank_ref text,
  thrive_ref text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
) ON COMMIT DROP;
INSERT INTO seed_deals (deal_key, id, client_key, primary_vendor_key, owner_vendor_key, product_key, price, currency, vat_pct, vat_mode, discount, sales_status, billing_status, payment_processor, gi_client_id, gi_invoice_series, stripe_customer_id, stripe_payment_link, wise_iban, wise_bank_ref, thrive_ref, notes, created_at, updated_at) VALUES
('d01', gen_random_uuid(), 'c01', 'v01', 'v10', 'p01', 3312.00, 'EUR', 17, 'excl', NULL, 'lead', 'pending', 'stripe', 'GI-C-3961', NULL, 'cus_972064D01', 'https://buy.stripe.com/d016038', NULL, NULL, NULL, NULL, '2025-09-27 10:00:00+00', '2025-11-01 10:00:00+00'),
('d02', gen_random_uuid(), 'c02', 'v02', NULL, 'p02', 237.50, 'EUR', 0, 'excl', NULL, 'lead', 'pending', 'wise', NULL, NULL, NULL, NULL, 'IL59-0110-0000-2233-0000-101', 'WISE-2026-73699', NULL, NULL, '2025-10-07 11:00:00+00', '2025-10-16 11:00:00+00'),
('d03', gen_random_uuid(), 'c21', 'v03', 'v11', NULL, 1400.00, 'USD', 23, 'incl', '10%', 'lead', 'pending', 'other', 'GI-C-5893', NULL, NULL, NULL, NULL, NULL, NULL, 'נדרש תיאום זמנים מול צוות הלקוח', '2025-10-12 12:00:00+00', '2025-11-09 12:00:00+00'),
('d04', gen_random_uuid(), 'c04', 'v04', 'v12', 'p04', 2232.00, 'EUR', 17, 'incl', NULL, 'qualified', 'pending', 'thrive', NULL, NULL, NULL, NULL, NULL, NULL, 'THRIVE-2026-7932', 'Client requested Hebrew summaries after each call.', '2025-10-23 13:00:00+00', '2025-11-26 13:00:00+00'),
('d05', gen_random_uuid(), 'c22', 'v05', NULL, 'p05', 6540.00, 'EUR', 23, 'excl', '€200', 'qualified', 'pending', 'stripe', 'GI-C-7502', NULL, 'cus_426858D05', 'https://buy.stripe.com/d057537', NULL, NULL, NULL, NULL, '2025-10-28 14:00:00+00', '2025-11-26 14:00:00+00'),
('d06', gen_random_uuid(), 'c06', 'v06', 'v13', 'p03', 1164.00, 'EUR', 17, 'excl', NULL, 'qualified', 'pending', 'wise', NULL, NULL, NULL, NULL, 'IL59-0110-0000-2233-0000-101', 'WISE-2026-42493', NULL, 'Client requested Hebrew summaries after each call.', '2025-11-08 10:00:00+00', '2025-11-29 10:00:00+00'),
('d07', gen_random_uuid(), 'c23', 'v07', 'v15', NULL, 2200.00, 'EUR', 0, 'excl', NULL, 'qualified', 'pending', 'other', 'GI-C-6537', NULL, NULL, NULL, NULL, NULL, NULL, 'Client requested Hebrew summaries after each call.', '2025-11-12 11:00:00+00', '2025-12-07 11:00:00+00'),
('d08', gen_random_uuid(), 'c08', 'v08', NULL, 'p06', 408.00, 'EUR', 17, 'incl', '2 sessions free', 'active', 'invoiced', 'stripe', NULL, NULL, 'cus_170674D08', 'https://buy.stripe.com/d081514', NULL, NULL, NULL, 'Kickoff approved by procurement.', '2025-11-20 12:00:00+00', '2026-03-12 08:15:00+00'),
('d09', gen_random_uuid(), 'c24', 'v09', 'v16', 'p07', 546.00, 'USD', 23, 'excl', NULL, 'active', 'partial', 'wise', 'GI-C-7925', NULL, NULL, NULL, 'IL41-0910-0000-5511-0000-303', 'WISE-2026-27342', NULL, 'נדרש תיאום זמנים מול צוות הלקוח', '2025-11-29 13:00:00+00', '2026-03-18 15:15:00+00'),
('d10', gen_random_uuid(), 'c10', 'v01', 'v10', 'p02', 255.00, 'EUR', 17, 'excl', NULL, 'active', 'paid', 'thrive', NULL, 'GI-2026-199', NULL, NULL, NULL, NULL, 'THRIVE-2026-2545', NULL, '2025-12-07 14:00:00+00', '2026-03-25 14:15:00+00'),
('d11', gen_random_uuid(), 'c25', 'v02', NULL, 'p08', 4950.00, 'USD', 23, 'incl', NULL, 'active', 'overdue', 'stripe', 'GI-C-2496', NULL, 'cus_806073D11', 'https://buy.stripe.com/d112612', NULL, NULL, NULL, 'Awaiting internal PO from client finance team.', '2025-12-17 10:00:00+00', '2026-03-23 15:00:00+00'),
('d12', gen_random_uuid(), 'c12', 'v03', 'v14', 'p01', 3780.00, 'EUR', 17, 'excl', '€150', 'active', 'partial', 'wise', NULL, NULL, NULL, NULL, 'IL41-0910-0000-5511-0000-303', 'WISE-2026-68800', NULL, 'Client requested Hebrew summaries after each call.', '2025-12-22 11:00:00+00', '2026-03-17 11:15:00+00'),
('d13', gen_random_uuid(), 'c26', 'v04', NULL, NULL, 1400.00, 'EUR', 0, 'excl', NULL, 'active', 'paid', 'other', 'GI-C-5630', 'GI-2026-927', NULL, NULL, NULL, NULL, NULL, 'נדרש תיאום זמנים מול צוות הלקוח', '2026-01-01 12:00:00+00', '2026-03-24 11:00:00+00'),
('d14', gen_random_uuid(), 'c14', 'v05', 'v11', 'p03', 1104.00, 'EUR', 17, 'incl', NULL, 'active', 'overdue', 'stripe', NULL, NULL, 'cus_274389D14', 'https://buy.stripe.com/d147658', NULL, NULL, NULL, 'Awaiting internal PO from client finance team.', '2026-01-11 13:00:00+00', '2026-03-10 09:15:00+00'),
('d15', gen_random_uuid(), 'c27', 'v06', 'v12', 'p05', 6000.00, 'EUR', 23, 'excl', '10%', 'delivered', 'paid', 'stripe', 'GI-C-2017', NULL, 'cus_272634D15', 'https://buy.stripe.com/d157209', NULL, NULL, NULL, 'Awaiting internal PO from client finance team.', '2026-01-18 14:00:00+00', '2026-03-02 14:00:00+00'),
('d16', gen_random_uuid(), 'c16', 'v07', NULL, 'p06', 380.00, 'EUR', 17, 'excl', NULL, 'delivered', 'paid', 'wise', NULL, 'GI-2026-777', NULL, NULL, 'IL11-0310-0000-8899-0000-202', 'WISE-2026-82845', NULL, NULL, '2026-01-26 10:00:00+00', '2026-03-25 10:00:00+00'),
('d17', gen_random_uuid(), 'c28', 'v08', 'v17', NULL, 1400.00, 'EUR', 23, 'incl', NULL, 'delivered', 'partial', 'thrive', 'GI-C-9935', NULL, NULL, NULL, NULL, NULL, 'THRIVE-2026-4566', NULL, '2026-02-01 11:00:00+00', '2026-03-31 11:00:00+00'),
('d18', gen_random_uuid(), 'c18', 'v09', NULL, 'p07', 612.00, 'USD', 0, 'excl', '€100', 'delivered', 'paid', 'other', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-12 12:00:00+00', '2026-03-27 12:00:00+00'),
('d19', gen_random_uuid(), 'c29', 'v01', 'v13', 'p08', 4800.00, 'USD', 17, 'incl', NULL, 'closed', 'paid', 'stripe', 'GI-C-9531', 'GI-2026-973', 'cus_599948D19', 'https://buy.stripe.com/d199238', NULL, NULL, NULL, 'נדרש תיאום זמנים מול צוות הלקוח', '2026-02-16 13:00:00+00', '2026-03-13 13:00:00+00'),
('d20', gen_random_uuid(), 'c30', 'v02', NULL, 'p05', 5580.00, 'EUR', 23, 'excl', NULL, 'closed', 'paid', 'wise', NULL, NULL, NULL, NULL, 'IL59-0110-0000-2233-0000-101', 'WISE-2026-18981', NULL, 'נדרש תיאום זמנים מול צוות הלקוח', '2026-02-28 14:00:00+00', '2026-03-09 14:00:00+00');
INSERT INTO deals (id, client_id, primary_vendor_id, owner_vendor_id, product_id, price, currency, vat_pct, vat_mode, discount, sales_status, billing_status, payment_processor, gi_client_id, gi_invoice_series, stripe_customer_id, stripe_payment_link, wise_iban, wise_bank_ref, thrive_ref, notes, created_at, updated_at)
SELECT d.id, c.id, pv.id, ov.id, p.id, d.price, d.currency, d.vat_pct, d.vat_mode, d.discount, d.sales_status, d.billing_status, d.payment_processor, d.gi_client_id, d.gi_invoice_series, d.stripe_customer_id, d.stripe_payment_link, d.wise_iban, d.wise_bank_ref, d.thrive_ref, d.notes, d.created_at, d.updated_at
FROM seed_deals d
JOIN seed_clients c ON c.client_key = d.client_key
JOIN seed_vendors pv ON pv.vendor_key = d.primary_vendor_key
LEFT JOIN seed_vendors ov ON ov.vendor_key = d.owner_vendor_key
LEFT JOIN seed_products p ON p.product_key = d.product_key;

-- Vendor-client assignments
INSERT INTO vendor_clients (id, vendor_id, client_id, created_at)
SELECT gen_random_uuid(), v.id, c.id, now()
FROM (
  VALUES
  ('v01', 'c01'),
  ('v01', 'c04'),
  ('v01', 'c10'),
  ('v01', 'c19'),
  ('v01', 'c29'),
  ('v02', 'c02'),
  ('v02', 'c11'),
  ('v02', 'c20'),
  ('v02', 'c30'),
  ('v03', 'c03'),
  ('v03', 'c12'),
  ('v03', 'c21'),
  ('v03', 'c26'),
  ('v04', 'c05'),
  ('v04', 'c13'),
  ('v04', 'c25'),
  ('v05', 'c06'),
  ('v05', 'c14'),
  ('v05', 'c18'),
  ('v05', 'c22'),
  ('v05', 'c28'),
  ('v06', 'c07'),
  ('v06', 'c27'),
  ('v07', 'c16'),
  ('v09', 'c09'),
  ('v09', 'c24'),
  ('v10', 'c01'),
  ('v10', 'c08'),
  ('v10', 'c15'),
  ('v11', 'c03'),
  ('v11', 'c17'),
  ('v12', 'c12'),
  ('v13', 'c04'),
  ('v13', 'c21'),
  ('v13', 'c29'),
  ('v14', 'c02'),
  ('v14', 'c25'),
  ('v15', 'c23'),
  ('v16', 'c10'),
  ('v16', 'c24'),
  ('v17', 'c14'),
  ('v17', 'c30')
) AS vc(vendor_key, client_key)
JOIN seed_vendors v ON v.vendor_key = vc.vendor_key
JOIN seed_clients c ON c.client_key = vc.client_key;

-- Sessions
CREATE TEMP TABLE seed_sessions (
  session_key text PRIMARY KEY,
  id uuid NOT NULL,
  deal_key text,
  vendor_key text,
  client_key text,
  session_date date,
  start_time time,
  duration_min integer,
  session_type session_type,
  status session_status,
  notes text,
  created_at timestamptz
) ON COMMIT DROP;
INSERT INTO seed_sessions (session_key, id, deal_key, vendor_key, client_key, session_date, start_time, duration_min, session_type, status, notes, created_at) VALUES
('s001', gen_random_uuid(), 'd08', 'v08', 'c08', '2026-01-14', '15:30', 60, 'editing', 'done', NULL, '2026-01-14 08:30:00+00'),
('s002', gen_random_uuid(), 'd08', 'v08', 'c08', '2026-03-21', '09:00', 90, 'editing', 'no_show', 'סיכום בעברית נשלח לאחר הפגישה', '2026-03-21 08:30:00+00'),
('s003', gen_random_uuid(), 'd08', 'v08', 'c08', '2026-03-31', '10:30', 120, 'editing', 'planned', 'Client asked to shift next meeting by one week.', '2026-03-27 08:30:00+00'),
('s004', gen_random_uuid(), 'd08', 'v08', 'c08', '2026-04-07', '12:00', 90, 'editing', 'planned', 'Covered milestone review and action plan.', '2026-03-27 08:30:00+00'),
('s005', gen_random_uuid(), 'd08', 'v08', 'c08', '2026-01-22', '09:00', 60, 'editing', 'done', 'Client asked to shift next meeting by one week.', '2026-01-22 08:30:00+00'),
('s006', gen_random_uuid(), 'd09', 'v09', 'c24', '2026-03-05', '15:30', 60, 'design', 'no_show', NULL, '2026-03-05 08:30:00+00'),
('s007', gen_random_uuid(), 'd09', 'v09', 'c24', '2026-03-11', '09:00', 60, 'design', 'done', 'Client asked to shift next meeting by one week.', '2026-03-11 08:30:00+00'),
('s008', gen_random_uuid(), 'd09', 'v09', 'c24', '2026-02-22', '15:30', 120, 'design', 'done', 'Focus on stakeholder communication.', '2026-02-22 08:30:00+00'),
('s009', gen_random_uuid(), 'd09', 'v09', 'c24', '2026-02-13', '15:30', 60, 'design', 'no_show', NULL, '2026-02-13 08:30:00+00'),
('s010', gen_random_uuid(), 'd10', 'v01', 'c10', '2026-03-31', '12:00', 60, 'coaching', 'planned', 'Covered milestone review and action plan.', '2026-03-27 08:30:00+00'),
('s011', gen_random_uuid(), 'd10', 'v01', 'c10', '2026-01-19', '12:00', 90, 'coaching', 'no_show', 'Client asked to shift next meeting by one week.', '2026-01-19 08:30:00+00'),
('s012', gen_random_uuid(), 'd10', 'v01', 'c10', '2026-02-01', '17:00', 60, 'coaching', 'done', NULL, '2026-02-01 08:30:00+00'),
('s013', gen_random_uuid(), 'd10', 'v01', 'c10', '2026-03-11', '09:00', 120, 'consulting', 'cancelled', NULL, '2026-03-11 08:30:00+00'),
('s014', gen_random_uuid(), 'd11', 'v02', 'c25', '2026-03-01', '12:00', 60, 'coaching', 'done', NULL, '2026-03-01 08:30:00+00'),
('s015', gen_random_uuid(), 'd11', 'v02', 'c25', '2026-03-28', '17:00', 90, 'consulting', 'planned', 'Covered milestone review and action plan.', '2026-03-27 08:30:00+00'),
('s016', gen_random_uuid(), 'd11', 'v02', 'c25', '2026-03-17', '09:00', 60, 'design', 'cancelled', NULL, '2026-03-17 08:30:00+00'),
('s017', gen_random_uuid(), 'd11', 'v02', 'c25', '2026-04-04', '09:00', 60, 'coaching', 'planned', 'סיכום בעברית נשלח לאחר הפגישה', '2026-03-27 08:30:00+00'),
('s018', gen_random_uuid(), 'd11', 'v02', 'c25', '2026-03-21', '10:30', 60, 'coaching', 'no_show', 'Focus on stakeholder communication.', '2026-03-21 08:30:00+00'),
('s019', gen_random_uuid(), 'd12', 'v03', 'c12', '2026-02-14', '10:30', 120, 'coaching', 'done', 'Client asked to shift next meeting by one week.', '2026-02-14 08:30:00+00'),
('s020', gen_random_uuid(), 'd12', 'v03', 'c12', '2026-02-06', '14:00', 90, 'editing', 'done', 'סיכום בעברית נשלח לאחר הפגישה', '2026-02-06 08:30:00+00'),
('s021', gen_random_uuid(), 'd12', 'v03', 'c12', '2026-04-11', '10:30', 60, 'consulting', 'planned', 'Covered milestone review and action plan.', '2026-03-27 08:30:00+00'),
('s022', gen_random_uuid(), 'd12', 'v03', 'c12', '2026-02-27', '12:00', 90, 'consulting', 'done', NULL, '2026-02-27 08:30:00+00'),
('s023', gen_random_uuid(), 'd13', 'v04', 'c26', '2026-04-01', '12:00', 60, 'admin', 'planned', 'Covered milestone review and action plan.', '2026-03-27 08:30:00+00'),
('s024', gen_random_uuid(), 'd13', 'v04', 'c26', '2026-04-16', '14:00', 60, 'admin', 'planned', NULL, '2026-03-27 08:30:00+00'),
('s025', gen_random_uuid(), 'd13', 'v04', 'c26', '2026-03-07', '12:00', 60, 'coaching', 'done', 'Focus on stakeholder communication.', '2026-03-07 08:30:00+00'),
('s026', gen_random_uuid(), 'd13', 'v04', 'c26', '2026-02-04', '10:30', 90, 'coaching', 'done', NULL, '2026-02-04 08:30:00+00'),
('s027', gen_random_uuid(), 'd14', 'v05', 'c14', '2026-02-17', '12:00', 120, 'coaching', 'done', 'Client asked to shift next meeting by one week.', '2026-02-17 08:30:00+00'),
('s028', gen_random_uuid(), 'd14', 'v05', 'c14', '2026-03-12', '09:00', 60, 'consulting', 'cancelled', NULL, '2026-03-12 08:30:00+00'),
('s029', gen_random_uuid(), 'd14', 'v05', 'c14', '2026-01-28', '09:00', 90, 'consulting', 'no_show', NULL, '2026-01-28 08:30:00+00'),
('s030', gen_random_uuid(), 'd14', 'v05', 'c14', '2026-03-02', '15:30', 90, 'consulting', 'done', 'Focus on stakeholder communication.', '2026-03-02 08:30:00+00'),
('s031', gen_random_uuid(), 'd15', 'v06', 'c27', '2026-01-20', '09:00', 120, 'design', 'cancelled', 'Client asked to shift next meeting by one week.', '2026-01-20 08:30:00+00'),
('s032', gen_random_uuid(), 'd15', 'v06', 'c27', '2026-03-02', '14:00', 60, 'design', 'done', 'Client asked to shift next meeting by one week.', '2026-03-02 08:30:00+00'),
('s033', gen_random_uuid(), 'd15', 'v06', 'c27', '2026-04-01', '12:00', 120, 'editing', 'planned', 'סיכום בעברית נשלח לאחר הפגישה', '2026-03-27 08:30:00+00'),
('s034', gen_random_uuid(), 'd15', 'v06', 'c27', '2026-01-21', '14:00', 60, 'editing', 'done', NULL, '2026-01-21 08:30:00+00'),
('s035', gen_random_uuid(), 'd15', 'v06', 'c27', '2026-02-26', '14:00', 120, 'design', 'done', 'Covered milestone review and action plan.', '2026-02-26 08:30:00+00'),
('s036', gen_random_uuid(), 'd16', 'v07', 'c16', '2026-02-23', '15:30', 60, 'editing', 'done', 'Focus on stakeholder communication.', '2026-02-23 08:30:00+00'),
('s037', gen_random_uuid(), 'd16', 'v07', 'c16', '2026-02-13', '15:30', 90, 'admin', 'done', 'Focus on stakeholder communication.', '2026-02-13 08:30:00+00'),
('s038', gen_random_uuid(), 'd16', 'v07', 'c16', '2026-03-30', '14:00', 90, 'editing', 'planned', 'Focus on stakeholder communication.', '2026-03-27 08:30:00+00'),
('s039', gen_random_uuid(), 'd16', 'v07', 'c16', '2026-04-02', '14:00', 120, 'admin', 'planned', 'סיכום בעברית נשלח לאחר הפגישה', '2026-03-27 08:30:00+00'),
('s040', gen_random_uuid(), 'd17', 'v08', 'c28', '2026-01-27', '17:00', 120, 'editing', 'done', 'סיכום בעברית נשלח לאחר הפגישה', '2026-01-27 08:30:00+00'),
('s041', gen_random_uuid(), 'd17', 'v08', 'c28', '2026-03-26', '17:00', 60, 'editing', 'done', 'Covered milestone review and action plan.', '2026-03-26 08:30:00+00'),
('s042', gen_random_uuid(), 'd17', 'v08', 'c28', '2026-02-03', '09:00', 60, 'editing', 'done', NULL, '2026-02-03 08:30:00+00'),
('s043', gen_random_uuid(), 'd17', 'v08', 'c28', '2026-03-07', '14:00', 120, 'editing', 'no_show', 'Focus on stakeholder communication.', '2026-03-07 08:30:00+00'),
('s044', gen_random_uuid(), 'd17', 'v08', 'c28', '2026-03-20', '14:00', 60, 'editing', 'done', 'Focus on stakeholder communication.', '2026-03-20 08:30:00+00'),
('s045', gen_random_uuid(), 'd18', 'v09', 'c18', '2026-01-24', '10:30', 60, 'design', 'done', 'Focus on stakeholder communication.', '2026-01-24 08:30:00+00'),
('s046', gen_random_uuid(), 'd18', 'v09', 'c18', '2026-04-05', '15:30', 60, 'admin', 'planned', NULL, '2026-03-27 08:30:00+00'),
('s047', gen_random_uuid(), 'd18', 'v09', 'c18', '2026-01-21', '17:00', 90, 'design', 'cancelled', 'Focus on stakeholder communication.', '2026-01-21 08:30:00+00'),
('s048', gen_random_uuid(), 'd18', 'v09', 'c18', '2026-03-18', '15:30', 120, 'admin', 'no_show', 'Focus on stakeholder communication.', '2026-03-18 08:30:00+00');
INSERT INTO sessions (id, deal_id, vendor_id, client_id, session_date, start_time, duration_min, session_type, status, notes, created_at)
SELECT s.id, d.id, v.id, c.id, s.session_date, s.start_time, s.duration_min, s.session_type, s.status, s.notes, s.created_at
FROM seed_sessions s
JOIN seed_deals d ON d.deal_key = s.deal_key
JOIN seed_vendors v ON v.vendor_key = s.vendor_key
JOIN seed_clients c ON c.client_key = s.client_key;

-- Vendor hours
INSERT INTO vendor_hours (id, vendor_id, deal_id, session_id, date, hours, session_type, rate, notes, synced, created_at)
SELECT gen_random_uuid(), v.id, d.id, s.id, vh.date::date, vh.hours, vh.session_type::session_type, vh.rate, vh.notes, vh.synced, vh.created_at::timestamptz
FROM (
  VALUES
  ('v06', 'd15', 's033', '2026-03-27', 2.50, 'editing', 95.00, 'Edited materials', true, '2026-03-27 19:00:00+00'),
  ('v05', 'd14', 's028', '2026-03-12', 1.50, 'consulting', 175.00, 'Client recap email', true, '2026-03-12 19:00:00+00'),
  ('v07', 'd16', 's036', '2026-02-26', 2.50, 'editing', 85.00, NULL, true, '2026-02-26 19:00:00+00'),
  ('v05', 'd14', 's029', '2026-01-29', 2.00, 'consulting', 175.00, 'Prep and follow-up', true, '2026-01-29 19:00:00+00'),
  ('v01', 'd10', 's011', '2026-01-26', 2.00, 'coaching', 150.00, NULL, true, '2026-01-26 19:00:00+00'),
  ('v06', 'd15', 's031', '2026-01-26', 3.00, 'design', 105.00, 'Edited materials', true, '2026-01-26 19:00:00+00'),
  ('v09', 'd18', 's045', '2026-01-27', 1.00, 'design', 115.00, NULL, false, '2026-01-27 19:00:00+00'),
  ('v02', 'd11', 's017', '2026-03-27', 2.00, 'coaching', 180.00, NULL, true, '2026-03-27 19:00:00+00'),
  ('v02', 'd11', 's016', '2026-03-17', 0.50, 'design', 120.00, 'Edited materials', true, '2026-03-17 19:00:00+00'),
  ('v02', 'd11', 's018', '2026-03-24', 1.00, 'coaching', 180.00, NULL, true, '2026-03-24 19:00:00+00'),
  ('v06', 'd15', 's034', '2026-01-26', 1.50, 'editing', 95.00, 'Prep and follow-up', true, '2026-01-26 19:00:00+00'),
  ('v06', 'd15', 's032', '2026-03-04', 1.50, 'design', 105.00, 'Edited materials', true, '2026-03-04 19:00:00+00'),
  ('v08', 'd17', 's040', '2026-01-30', 1.50, 'editing', 125.00, NULL, true, '2026-01-30 19:00:00+00'),
  ('v07', 'd16', 's039', '2026-03-27', 3.00, 'admin', 75.00, NULL, true, '2026-03-27 19:00:00+00'),
  ('v08', 'd17', 's042', '2026-02-05', 1.00, 'editing', 125.00, NULL, true, '2026-02-05 19:00:00+00'),
  ('v08', 'd08', 's005', '2026-01-26', 1.00, 'editing', 125.00, 'Prep and follow-up', true, '2026-01-26 19:00:00+00'),
  ('v03', 'd12', 's019', '2026-02-15', 1.00, 'coaching', 145.00, 'Prep and follow-up', true, '2026-02-15 19:00:00+00'),
  ('v09', 'd09', 's008', '2026-02-22', 2.50, 'design', 115.00, 'Prep and follow-up', true, '2026-02-22 19:00:00+00'),
  ('v09', 'd09', 's009', '2026-02-15', 1.50, 'design', 115.00, 'Prep and follow-up', true, '2026-02-15 19:00:00+00'),
  ('v08', 'd17', 's044', '2026-03-20', 1.00, 'editing', 125.00, 'Client recap email', true, '2026-03-20 19:00:00+00'),
  ('v07', 'd16', 's038', '2026-03-27', 1.50, 'editing', 85.00, NULL, true, '2026-03-27 19:00:00+00'),
  ('v06', 'd15', 's035', '2026-03-01', 3.00, 'design', 105.00, 'Prep and follow-up', true, '2026-03-01 19:00:00+00'),
  ('v08', 'd08', 's003', '2026-03-27', 0.50, 'editing', 125.00, 'Client recap email', true, '2026-03-27 19:00:00+00'),
  ('v09', 'd18', 's048', '2026-03-18', 2.50, 'admin', 80.00, NULL, true, '2026-03-18 19:00:00+00'),
  ('v04', 'd13', 's025', '2026-03-10', 3.00, 'coaching', 155.00, 'Client recap email', true, '2026-03-10 19:00:00+00'),
  ('v08', 'd17', 's043', '2026-03-09', 0.50, 'editing', 125.00, 'Edited materials', true, '2026-03-09 19:00:00+00'),
  ('v01', 'd10', 's013', '2026-03-11', 2.00, 'consulting', 165.00, 'Client recap email', true, '2026-03-11 19:00:00+00'),
  ('v04', 'd13', 's024', '2026-03-27', 2.00, 'admin', 95.00, 'Prep and follow-up', false, '2026-03-27 19:00:00+00'),
  ('v09', 'd09', 's007', '2026-03-13', 2.50, 'design', 115.00, NULL, true, '2026-03-13 19:00:00+00'),
  ('v04', 'd13', 's026', '2026-02-07', 2.00, 'coaching', 155.00, NULL, true, '2026-02-07 19:00:00+00'),
  ('v02', 'd11', 's014', '2026-03-03', 1.00, 'coaching', 180.00, NULL, true, '2026-03-03 19:00:00+00'),
  ('v05', 'd14', 's027', '2026-02-20', 1.00, 'coaching', 160.00, 'Edited materials', true, '2026-02-20 19:00:00+00'),
  ('v09', 'd18', 's047', '2026-01-26', 1.50, 'design', 115.00, NULL, true, '2026-01-26 19:00:00+00'),
  ('v05', 'd14', 's030', '2026-03-04', 1.00, 'consulting', 175.00, 'Edited materials', true, '2026-03-04 19:00:00+00'),
  ('v04', 'd13', 's023', '2026-03-27', 1.50, 'admin', 95.00, 'Client recap email', true, '2026-03-27 19:00:00+00'),
  ('v03', 'd12', 's020', '2026-02-08', 2.50, 'editing', 90.00, NULL, false, '2026-02-08 19:00:00+00'),
  ('v08', 'd08', 's001', '2026-01-26', 0.50, 'editing', 125.00, 'Prep and follow-up', true, '2026-01-26 19:00:00+00'),
  ('v08', 'd08', 's004', '2026-03-27', 2.50, 'editing', 125.00, 'Prep and follow-up', true, '2026-03-27 19:00:00+00'),
  ('v03', 'd12', 's022', '2026-03-02', 2.00, 'consulting', 155.00, NULL, true, '2026-03-02 19:00:00+00'),
  ('v01', 'd10', 's010', '2026-03-27', 1.00, 'coaching', 150.00, 'Edited materials', true, '2026-03-27 19:00:00+00'),
  ('v10', 'd12', NULL, '2026-02-27', 3.00, 'consulting', 105.00, NULL, true, '2026-02-27 19:00:00+00'),
  ('v12', NULL, NULL, '2026-03-12', 0.50, 'admin', 72.00, 'Internal coordination', true, '2026-03-12 19:00:00+00'),
  ('v04', NULL, NULL, '2026-03-15', 1.00, 'admin', 95.00, 'Internal coordination', true, '2026-03-15 19:00:00+00'),
  ('v09', NULL, NULL, '2026-03-20', 1.00, 'admin', 80.00, 'Async support', true, '2026-03-20 19:00:00+00'),
  ('v12', 'd01', NULL, '2026-03-09', 0.50, 'coaching', 95.00, NULL, true, '2026-03-09 19:00:00+00'),
  ('v10', 'd05', NULL, '2026-03-20', 0.50, 'consulting', 105.00, NULL, true, '2026-03-20 19:00:00+00'),
  ('v16', 'd11', NULL, '2026-03-10', 2.00, 'consulting', 102.00, NULL, true, '2026-03-10 19:00:00+00'),
  ('v13', 'd19', NULL, '2026-03-17', 1.00, 'consulting', 110.00, NULL, true, '2026-03-17 19:00:00+00'),
  ('v03', 'd12', 's020', '2026-02-05', 2.50, 'editing', 90.00, 'Admin follow-up', true, '2026-02-05 19:00:00+00'),
  ('v15', 'd19', NULL, '2026-02-18', 2.50, 'admin', 74.00, NULL, false, '2026-02-18 19:00:00+00'),
  ('v04', 'd13', 's025', '2026-02-12', 0.50, 'coaching', 155.00, 'Internal coordination', true, '2026-02-12 19:00:00+00'),
  ('v06', 'd06', 's035', '2026-02-24', 1.50, 'design', 105.00, NULL, true, '2026-02-24 19:00:00+00'),
  ('v10', NULL, NULL, '2026-03-22', 3.00, 'consulting', 105.00, 'Internal coordination', true, '2026-03-22 19:00:00+00'),
  ('v07', 'd07', NULL, '2026-02-02', 1.00, 'editing', 85.00, NULL, true, '2026-02-02 19:00:00+00'),
  ('v06', NULL, NULL, '2026-02-26', 0.50, 'editing', 95.00, 'Admin follow-up', true, '2026-02-26 19:00:00+00'),
  ('v13', NULL, NULL, '2026-02-26', 0.50, 'consulting', 110.00, NULL, true, '2026-02-26 19:00:00+00'),
  ('v14', NULL, NULL, '2026-03-21', 1.00, 'admin', 85.00, NULL, false, '2026-03-21 19:00:00+00'),
  ('v01', NULL, NULL, '2026-02-18', 0.50, 'consulting', 165.00, 'Internal coordination', true, '2026-02-18 19:00:00+00'),
  ('v17', 'd09', NULL, '2026-02-14', 2.00, 'admin', 78.00, NULL, true, '2026-02-14 19:00:00+00'),
  ('v12', 'd11', NULL, '2026-03-05', 2.00, 'coaching', 95.00, 'Admin follow-up', true, '2026-03-05 19:00:00+00'),
  ('v13', NULL, NULL, '2026-03-21', 1.50, 'consulting', 110.00, 'Async support', true, '2026-03-21 19:00:00+00'),
  ('v04', 'd13', 's023', '2026-02-12', 2.50, 'admin', 95.00, 'Admin follow-up', true, '2026-02-12 19:00:00+00'),
  ('v02', 'd11', NULL, '2026-02-14', 2.00, 'consulting', 190.00, NULL, true, '2026-02-14 19:00:00+00'),
  ('v09', 'd18', 's007', '2026-03-25', 3.00, 'design', 115.00, NULL, true, '2026-03-25 19:00:00+00'),
  ('v06', 'd06', NULL, '2026-03-12', 0.50, 'design', 105.00, 'Admin follow-up', true, '2026-03-12 19:00:00+00'),
  ('v05', 'd14', NULL, '2026-02-28', 2.00, 'consulting', 175.00, 'Admin follow-up', true, '2026-02-28 19:00:00+00'),
  ('v15', 'd13', NULL, '2026-01-30', 0.50, 'admin', 74.00, 'Async support', true, '2026-01-30 19:00:00+00'),
  ('v11', NULL, NULL, '2026-03-08', 3.00, 'admin', 68.00, 'Async support', false, '2026-03-08 19:00:00+00'),
  ('v16', NULL, NULL, '2026-03-04', 1.50, 'admin', 76.00, NULL, true, '2026-03-04 19:00:00+00'),
  ('v13', 'd11', NULL, '2026-02-18', 2.00, 'consulting', 110.00, 'Internal coordination', true, '2026-02-18 19:00:00+00'),
  ('v02', 'd11', NULL, '2026-03-02', 3.00, 'consulting', 190.00, 'Internal coordination', true, '2026-03-02 19:00:00+00'),
  ('v02', 'd20', 's017', '2026-03-20', 2.50, 'coaching', 180.00, 'Admin follow-up', true, '2026-03-20 19:00:00+00'),
  ('v05', 'd05', 's029', '2026-02-15', 3.00, 'consulting', 175.00, 'Admin follow-up', true, '2026-02-15 19:00:00+00'),
  ('v11', NULL, NULL, '2026-03-06', 3.00, 'admin', 68.00, 'Admin follow-up', true, '2026-03-06 19:00:00+00'),
  ('v02', 'd02', NULL, '2026-03-12', 3.00, 'consulting', 190.00, NULL, true, '2026-03-12 19:00:00+00'),
  ('v04', NULL, NULL, '2026-02-26', 1.00, 'coaching', 155.00, 'Async support', true, '2026-02-26 19:00:00+00'),
  ('v02', 'd02', 's017', '2026-03-17', 1.00, 'coaching', 180.00, NULL, true, '2026-03-17 19:00:00+00'),
  ('v06', 'd06', NULL, '2026-02-15', 3.00, 'editing', 95.00, 'Internal coordination', true, '2026-02-15 19:00:00+00'),
  ('v05', 'd14', 's030', '2026-01-28', 1.50, 'consulting', 175.00, NULL, true, '2026-01-28 19:00:00+00'),
  ('v03', 'd12', NULL, '2026-02-14', 2.00, 'editing', 90.00, 'Async support', true, '2026-02-14 19:00:00+00'),
  ('v10', 'd13', NULL, '2026-03-11', 2.00, 'admin', 70.00, NULL, true, '2026-03-11 19:00:00+00'),
  ('v10', NULL, NULL, '2026-03-09', 0.50, 'consulting', 105.00, NULL, true, '2026-03-09 19:00:00+00'),
  ('v16', NULL, NULL, '2026-02-16', 1.50, 'consulting', 102.00, 'Internal coordination', true, '2026-02-16 19:00:00+00'),
  ('v09', 'd09', NULL, '2026-03-07', 2.00, 'design', 115.00, NULL, false, '2026-03-07 19:00:00+00'),
  ('v12', NULL, NULL, '2026-03-06', 3.00, 'admin', 72.00, 'Admin follow-up', true, '2026-03-06 19:00:00+00'),
  ('v07', 'd16', NULL, '2026-02-01', 1.00, 'editing', 85.00, 'Async support', true, '2026-02-01 19:00:00+00'),
  ('v10', NULL, NULL, '2026-02-25', 0.50, 'admin', 70.00, 'Internal coordination', true, '2026-02-25 19:00:00+00'),
  ('v13', NULL, NULL, '2026-03-21', 2.00, 'consulting', 110.00, NULL, true, '2026-03-21 19:00:00+00'),
  ('v04', 'd13', NULL, '2026-03-03', 0.50, 'admin', 95.00, 'Internal coordination', true, '2026-03-03 19:00:00+00'),
  ('v01', 'd19', 's011', '2026-02-13', 0.50, 'coaching', 150.00, 'Admin follow-up', true, '2026-02-13 19:00:00+00')
) AS vh(vendor_key, deal_key, session_key, date, hours, session_type, rate, notes, synced, created_at)
JOIN seed_vendors v ON v.vendor_key = vh.vendor_key
LEFT JOIN seed_deals d ON d.deal_key = vh.deal_key
LEFT JOIN seed_sessions s ON s.session_key = vh.session_key;

-- Payments
INSERT INTO payments (id, deal_id, client_id, vendor_id, type, direction, amount, currency, payment_date, method, reference, status, tax_kind, notes, created_at)
SELECT gen_random_uuid(), d.id, c.id, v.id, p.type, p.direction, p.amount, p.currency, p.payment_date::date, p.method, p.reference, p.status, p.tax_kind, p.notes, p.created_at::timestamptz
FROM (
  VALUES
  ('d17', 'c28', NULL, 'incoming', 'in', 1400.00, 'EUR', '2026-03-07', 'stripe', 'RCPT-2026-74569', 'completed', 'vat', NULL, '2026-03-07 12:00:00+00'),
  ('d11', 'c25', NULL, 'incoming', 'in', 1732.50, 'USD', '2026-04-05', 'other', 'RCPT-2026-97881', 'completed', 'other', 'Installment payment', '2026-04-05 12:00:00+00'),
  ('d17', 'c28', NULL, 'incoming', 'in', 840.00, 'EUR', '2026-04-05', 'wise', 'RCPT-2026-58566', 'completed', 'vat', NULL, '2026-04-05 12:00:00+00'),
  ('d18', 'c18', NULL, 'incoming', 'in', 306.00, 'USD', '2026-03-15', 'wise', 'RCPT-2026-94518', 'failed', 'vat', NULL, '2026-03-15 12:00:00+00'),
  ('d16', 'c16', NULL, 'incoming', 'in', 380.00, 'EUR', '2026-03-15', 'other', 'RCPT-2026-96870', 'completed', 'vat', NULL, '2026-03-15 12:00:00+00'),
  ('d05', 'c22', NULL, 'incoming', 'in', 2289.00, 'EUR', '2026-03-20', 'bank_transfer', 'RCPT-2026-82641', 'completed', 'vat', 'Installment payment', '2026-03-20 12:00:00+00'),
  ('d11', 'c25', NULL, 'incoming', 'in', 4950.00, 'USD', '2026-03-20', 'stripe', 'RCPT-2026-28964', 'completed', 'vat', 'Awaiting final confirmation', '2026-03-20 12:00:00+00'),
  ('d09', 'c24', NULL, 'incoming', 'in', 546.00, 'USD', '2026-03-07', 'bank_transfer', 'RCPT-2026-56955', 'completed', 'vat', 'Awaiting final confirmation', '2026-03-07 12:00:00+00'),
  ('d04', 'c04', NULL, 'incoming', 'in', 2232.00, 'EUR', '2026-03-07', 'bank_transfer', 'RCPT-2026-78955', 'pending', 'vat', NULL, '2026-03-07 12:00:00+00'),
  ('d19', 'c29', NULL, 'incoming', 'in', 4800.00, 'USD', '2026-03-31', 'stripe', 'RCPT-2026-76039', 'pending', 'vat', NULL, '2026-03-31 12:00:00+00'),
  ('d20', 'c30', NULL, 'incoming', 'in', 5580.00, 'EUR', '2026-03-07', 'stripe', 'RCPT-2026-62640', 'pending', 'other', NULL, '2026-03-07 12:00:00+00'),
  ('d19', 'c29', NULL, 'incoming', 'in', 2880.00, 'USD', '2026-03-15', 'stripe', 'RCPT-2026-89730', 'completed', 'vat', NULL, '2026-03-15 12:00:00+00'),
  ('d08', 'c08', NULL, 'incoming', 'in', 408.00, 'EUR', '2026-03-31', 'other', 'RCPT-2026-79541', 'failed', 'vat', NULL, '2026-03-31 12:00:00+00'),
  ('d20', 'c30', NULL, 'incoming', 'in', 1395.00, 'EUR', '2026-03-15', 'bank_transfer', 'RCPT-2026-69186', 'pending', 'vat', NULL, '2026-03-15 12:00:00+00'),
  ('d14', 'c14', NULL, 'incoming', 'in', 662.40, 'EUR', '2026-04-05', 'stripe', 'RCPT-2026-65936', 'completed', 'vat', 'Awaiting final confirmation', '2026-04-05 12:00:00+00'),
  ('d15', 'c27', NULL, 'incoming', 'in', 3600.00, 'EUR', '2026-03-15', 'stripe', 'RCPT-2026-22219', 'completed', 'other', NULL, '2026-03-15 12:00:00+00'),
  ('d15', 'c27', NULL, 'incoming', 'in', 1500.00, 'EUR', '2026-03-31', 'stripe', 'RCPT-2026-56346', 'pending', 'other', NULL, '2026-03-31 12:00:00+00'),
  ('d13', 'c26', NULL, 'incoming', 'in', 700.00, 'EUR', '2026-03-15', 'bank_transfer', 'RCPT-2026-96079', 'completed', 'other', 'Installment payment', '2026-03-15 12:00:00+00'),
  (NULL, NULL, 'v04', 'payout', 'out', 1784.00, 'ILS', '2026-03-31', 'iban', 'PO-202603-476', 'completed', 'other', 'Includes preparation hours', '2026-03-31 12:00:00+00'),
  (NULL, NULL, 'v08', 'payout', 'out', 2107.00, 'USD', '2026-03-31', 'wise', 'PO-202603-885', 'pending', 'withholding', 'Includes preparation hours', '2026-03-31 12:00:00+00'),
  (NULL, NULL, 'v09', 'payout', 'out', 468.00, 'EUR', '2026-01-31', 'iban', 'PO-202601-379', 'pending', 'other', 'Monthly settlement', '2026-01-31 12:00:00+00'),
  (NULL, NULL, 'v12', 'payout', 'out', 375.00, 'EUR', '2026-01-31', 'wise', 'PO-202601-990', 'completed', NULL, NULL, '2026-01-31 12:00:00+00'),
  (NULL, NULL, 'v05', 'payout', 'out', 475.00, 'EUR', '2026-01-31', 'wise', 'PO-202601-864', 'pending', 'withholding', 'Monthly settlement', '2026-01-31 12:00:00+00'),
  (NULL, NULL, 'v14', 'payout', 'out', 2208.00, 'USD', '2026-02-28', 'paypal', 'PO-202602-261', 'completed', 'other', 'Includes preparation hours', '2026-02-28 12:00:00+00'),
  (NULL, NULL, 'v11', 'payout', 'out', 697.00, 'EUR', '2026-01-31', 'paypal', 'PO-202601-259', 'completed', 'withholding', 'Includes preparation hours', '2026-01-31 12:00:00+00'),
  (NULL, NULL, 'v03', 'payout', 'out', 1464.00, 'EUR', '2026-02-28', 'wise', 'PO-202602-777', 'completed', NULL, 'Includes preparation hours', '2026-02-28 12:00:00+00'),
  (NULL, NULL, 'v15', 'payout', 'out', 2046.00, 'EUR', '2026-02-28', 'iban', 'PO-202602-320', 'pending', 'withholding', 'Monthly settlement', '2026-02-28 12:00:00+00'),
  (NULL, NULL, 'v14', 'payout', 'out', 804.00, 'USD', '2026-02-28', 'paypal', 'PO-202602-794', 'pending', NULL, 'Includes preparation hours', '2026-02-28 12:00:00+00'),
  (NULL, NULL, NULL, 'expense', 'out', 189.00, 'EUR', '2026-03-16', 'card', 'EXP-2026-1744', 'completed', 'fee', 'Workspace software subscriptions', '2026-03-16 12:00:00+00'),
  (NULL, NULL, NULL, 'expense', 'out', 420.00, 'EUR', '2026-03-13', 'bank_transfer', 'EXP-2026-1897', 'completed', 'other', 'Travel reimbursement - client onsite', '2026-03-13 12:00:00+00')
) AS p(deal_key, client_key, vendor_key, type, direction, amount, currency, payment_date, method, reference, status, tax_kind, notes, created_at)
LEFT JOIN seed_deals d ON d.deal_key = p.deal_key
LEFT JOIN seed_clients c ON c.client_key = p.client_key
LEFT JOIN seed_vendors v ON v.vendor_key = p.vendor_key;

-- Invoices
INSERT INTO invoices (id, deal_id, external_ref, issue_date, amount, currency, status, notes, created_at)
SELECT gen_random_uuid(), d.id, i.external_ref, i.issue_date::date, i.amount, i.currency, i.status, i.notes, i.created_at::timestamptz
FROM (
  VALUES
  ('d08', 'INV-2025-001', '2025-12-08', 408.00, 'EUR', 'sent', 'Auto-sent from billing queue', '2025-12-08 08:00:00+00'),
  ('d15', 'INV-2026-002', '2026-02-23', 6000.00, 'EUR', 'sent', NULL, '2026-02-23 08:00:00+00'),
  ('d16', 'INV-2026-003', '2026-02-14', 380.00, 'EUR', 'paid', 'Partial invoice - milestone 1', '2026-02-14 08:00:00+00'),
  ('d15', 'GI-2026-004', '2026-01-25', 6000.00, 'EUR', 'overdue', NULL, '2026-01-25 08:00:00+00'),
  ('d15', 'INV-2026-005', '2026-02-28', 6000.00, 'EUR', 'overdue', 'Auto-sent from billing queue', '2026-02-28 08:00:00+00'),
  ('d13', 'GI-2026-006', '2026-01-07', 1400.00, 'EUR', 'paid', 'Partial invoice - milestone 1', '2026-01-07 08:00:00+00'),
  ('d17', 'INV-2026-007', '2026-02-11', 700.00, 'EUR', 'overdue', NULL, '2026-02-11 08:00:00+00'),
  ('d16', 'INV-2026-008', '2026-03-05', 380.00, 'EUR', 'draft', 'Auto-sent from billing queue', '2026-03-05 08:00:00+00'),
  ('d15', 'INV-2026-009', '2026-02-02', 6000.00, 'EUR', 'draft', NULL, '2026-02-02 08:00:00+00'),
  ('d18', 'INV-2026-010', '2026-03-11', 612.00, 'USD', 'paid', 'Partial invoice - milestone 1', '2026-03-11 08:00:00+00'),
  ('d10', 'GI-2025-011', '2025-12-21', 255.00, 'EUR', 'paid', 'Partial invoice - milestone 1', '2025-12-21 08:00:00+00'),
  ('d10', 'INV-2025-012', '2025-12-16', 191.25, 'EUR', 'sent', 'Partial invoice - milestone 1', '2025-12-16 08:00:00+00'),
  ('d17', 'INV-2026-013', '2026-03-14', 1400.00, 'EUR', 'paid', 'Partial invoice - milestone 1', '2026-03-14 08:00:00+00')
) AS i(deal_key, external_ref, issue_date, amount, currency, status, notes, created_at)
JOIN seed_deals d ON d.deal_key = i.deal_key;

-- Deal documents
INSERT INTO deal_documents (id, deal_id, name, type, url, storage_path, size_kb, created_at)
SELECT gen_random_uuid(), d.id, dd.name, dd.type, dd.url, dd.storage_path, dd.size_kb, dd.created_at::timestamptz
FROM (
  VALUES
  ('d20', 'Signed Proposal - D20', 'other', 'https://drive.google.com/file/d/1HSOSDOC00190/view', NULL, 219, '2025-11-01 09:00:00+00'),
  ('d05', 'Payment Receipt - D05', 'receipt', 'https://drive.google.com/file/d/1HSOSDOC00218/view', NULL, 298, '2025-11-08 09:00:00+00'),
  ('d15', 'Signed Proposal - D15', 'other', 'https://drive.google.com/file/d/1HSOSDOC00345/view', NULL, 360, '2025-11-15 09:00:00+00'),
  ('d02', 'Signed Proposal - D02', 'other', 'https://drive.google.com/file/d/1HSOSDOC00474/view', NULL, 95, '2025-11-22 09:00:00+00'),
  ('d10', 'Payment Receipt - D10', 'receipt', 'https://drive.google.com/file/d/1HSOSDOC00567/view', NULL, 77, '2025-11-29 09:00:00+00'),
  ('d02', 'Signed Proposal - D02', 'other', 'https://drive.google.com/file/d/1HSOSDOC00646/view', NULL, 97, '2025-12-06 09:00:00+00'),
  ('d03', 'SOW Addendum - D03', 'other', 'https://drive.google.com/file/d/1HSOSDOC00786/view', NULL, 317, '2025-12-13 09:00:00+00'),
  ('d13', 'Payment Receipt - D13', 'receipt', 'https://drive.google.com/file/d/1HSOSDOC00884/view', NULL, 341, '2025-12-20 09:00:00+00'),
  ('d02', 'Payment Receipt - D02', 'receipt', 'https://drive.google.com/file/d/1HSOSDOC00983/view', NULL, 391, '2025-12-27 09:00:00+00'),
  ('d07', 'Signed Proposal - D07', 'other', 'https://drive.google.com/file/d/1HSOSDOC01087/view', NULL, 301, '2026-01-03 09:00:00+00'),
  ('d17', 'Invoice Copy - D17', 'invoice', 'https://drive.google.com/file/d/1HSOSDOC01117/view', NULL, 288, '2026-01-10 09:00:00+00'),
  ('d04', 'Signed Proposal - D04', 'other', 'https://drive.google.com/file/d/1HSOSDOC01220/view', NULL, 316, '2026-01-17 09:00:00+00'),
  ('d06', 'Service Agreement - D06', 'agreement', 'https://drive.google.com/file/d/1HSOSDOC01341/view', NULL, 420, '2026-01-24 09:00:00+00'),
  ('d15', 'Payment Receipt - D15', 'receipt', 'https://drive.google.com/file/d/1HSOSDOC01477/view', NULL, 325, '2026-01-31 09:00:00+00'),
  ('d20', 'Invoice Copy - D20', 'invoice', 'https://drive.google.com/file/d/1HSOSDOC01556/view', NULL, 248, '2026-02-07 09:00:00+00'),
  ('d10', 'Payment Receipt - D10', 'receipt', 'https://drive.google.com/file/d/1HSOSDOC01662/view', NULL, 454, '2026-02-14 09:00:00+00')
) AS dd(deal_key, name, type, url, storage_path, size_kb, created_at)
JOIN seed_deals d ON d.deal_key = dd.deal_key;

-- Deal reminders
INSERT INTO deal_reminders (id, deal_id, text, done, due_date, created_at)
SELECT gen_random_uuid(), d.id, r.text, r.done, r.due_date::date, r.created_at::timestamptz
FROM (
  VALUES
  ('d10', 'Share post-session summary', false, '2026-04-05', '2026-02-01 08:00:00+00'),
  ('d08', 'Confirm payment timeline with finance', false, '2026-04-10', '2026-02-04 08:00:00+00'),
  ('d13', 'Follow up on contract signature', true, '2026-03-27', '2026-02-07 08:00:00+00'),
  ('d10', 'Share post-session summary', false, '2026-03-17', '2026-02-10 08:00:00+00'),
  ('d13', 'Schedule next coaching session', false, '2026-03-29', '2026-02-13 08:00:00+00'),
  ('d10', 'Confirm payment timeline with finance', true, '2026-04-05', '2026-02-16 08:00:00+00'),
  ('d12', 'Send milestone invoice', false, '2026-04-10', '2026-02-19 08:00:00+00'),
  ('d10', 'Share post-session summary', false, '2026-03-17', '2026-02-22 08:00:00+00'),
  ('d13', 'Schedule next coaching session', true, '2026-03-24', '2026-02-25 08:00:00+00'),
  ('d10', 'Confirm payment timeline with finance', false, '2026-04-05', '2026-02-28 08:00:00+00'),
  ('d13', 'Send milestone invoice', false, '2026-03-29', '2026-03-03 08:00:00+00'),
  ('d12', 'Follow up on contract signature', true, '2026-04-05', '2026-03-06 08:00:00+00')
) AS r(deal_key, text, done, due_date, created_at)
JOIN seed_deals d ON d.deal_key = r.deal_key;

COMMIT;

-- End of HSos dummy data seed
