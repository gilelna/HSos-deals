-- ============================================
-- HSos Complete Demo Dataset
-- Exercises all code paths and scenarios
-- Generated against live DB schema
-- ============================================
--
-- VENDOR ROLES:
--   Hadar Cohen   (d1d48ca9) → manager ONLY (owner_vendor_id only, never primary)
--   Jonathan Reed (fb1574df) → provider ONLY (primary_vendor_id only, never owner)
--   Maya Levi     (bd74f13a) → BOTH manager and provider
--   Eyal Mor      (490f2c6d) → typical coach, 5+ clients
--   Shani Katz    (b48713ca) → typical coach
--   Liam Porter   (06c21041) → contractor specialist
--   Nina Calder   (4a99814c) → new vendor, 1-2 clients
--   Ariella Bloom (8da706a5) → experienced, many clients
--
-- PRODUCT IDs (real):
--   Executive Coaching Package   (5408c47f) — package
--   Career Transition Package    (d247c635) — package
--   Leadership Development Prog  (84eb96f5) — package
--   1:1 Consulting Session       (325c4cf3) — session
--   Assessment & Strategy Sess   (8e0ae095) — session
--   Group Workshop               (e27cded5) — workshop
--   Custom Consulting Project    (5d291e19) — custom
-- ============================================

BEGIN;

-- ============================================
-- CLEAN SLATE
-- ============================================

TRUNCATE TABLE
  bills, sessions, packages, deals,
  vendor_clients, deal_reminders, deal_documents
CASCADE;

-- ============================================
-- UPDATE PRODUCTS: set default_package_sessions
-- ============================================

UPDATE products SET default_package_sessions = 10  WHERE id = '5408c47f-e96a-4e1c-ba54-dffd651327d7'; -- Executive Coaching
UPDATE products SET default_package_sessions = 8   WHERE id = 'd247c635-756f-4377-be04-3b06a3e79925'; -- Career Transition
UPDATE products SET default_package_sessions = 20  WHERE id = '84eb96f5-8728-49a0-8651-b837938dd473'; -- Leadership Dev

-- ============================================
-- BILLS (insert before sessions so FK works)
-- draft, submitted, returned, approved, paid × 2 vendors
-- ============================================

INSERT INTO bills (id, vendor_id, status, total_amount, currency, vendor_notes, finance_notes, payment_method, payment_reference, created_at, submitted_at, returned_at, approved_at, paid_at)
VALUES

  -- Maya Levi: DRAFT (in-progress, not yet submitted)
  ('a1000000-0000-0000-0000-000000000001',
   'bd74f13a-846b-4833-9f40-84c79987a3e9',
   'draft', 480.00, 'EUR',
   'March sessions — still adding a couple more',
   NULL, NULL, NULL,
   NOW() - INTERVAL '3 days', NULL, NULL, NULL, NULL),

  -- Eyal Mor: SUBMITTED (waiting on finance)
  ('a1000000-0000-0000-0000-000000000002',
   '490f2c6d-8f94-4f45-b778-3fc9f492c555',
   'submitted', 640.00, 'EUR',
   'Regular March billing — 8 sessions across 4 clients',
   NULL, NULL, NULL,
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days', NULL, NULL, NULL),

  -- Shani Katz: RETURNED (rejected, needs correction)
  ('a1000000-0000-0000-0000-000000000003',
   'b48713ca-dc11-4f3e-a1ae-9f7c5d497481',
   'returned', 320.00, 'EUR',
   'February catch-up bill',
   'Session on Feb 14 appears duplicated — please review and resubmit',
   NULL, NULL,
   NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '5 days', NULL, NULL),

  -- Liam Porter: APPROVED (finance approved, not yet paid)
  ('a1000000-0000-0000-0000-000000000004',
   '06c21041-f45f-48ac-968e-158029538ad0',
   'approved', 750.00, 'EUR',
   'Consulting work — 3 strategy sessions',
   NULL, NULL, NULL,
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NULL, NOW() - INTERVAL '2 days', NULL),

  -- Ariella Bloom: PAID (completed, bank transfer)
  ('a1000000-0000-0000-0000-000000000005',
   '8da706a5-2d53-47c9-9c96-740ef67f5398',
   'paid', 720.00, 'EUR',
   'February sessions — 9 sessions total',
   NULL, 'bank_transfer', 'TX-2026-02-15-001',
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '32 days', NULL, NOW() - INTERVAL '28 days', NOW() - INTERVAL '20 days'),

  -- Jonathan Reed: PAID (second paid bill — history)
  ('a1000000-0000-0000-0000-000000000006',
   'fb1574df-9535-4cd1-b02e-80dd86ec806e',
   'paid', 500.00, 'EUR',
   'January sessions',
   NULL, 'wise', 'WISE-2026-01-28',
   NOW() - INTERVAL '65 days', NOW() - INTERVAL '62 days', NULL, NOW() - INTERVAL '58 days', NOW() - INTERVAL '50 days'),

  -- Jonathan Reed: SUBMITTED (current bill — shows history)
  ('a1000000-0000-0000-0000-000000000007',
   'fb1574df-9535-4cd1-b02e-80dd86ec806e',
   'submitted', 400.00, 'EUR',
   'March sessions — 5 coaching sessions',
   NULL, NULL, NULL,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days', NULL, NULL, NULL);

-- ============================================
-- DEALS (25 covering all status combinations)
-- ============================================

INSERT INTO deals (id, client_id, product_id, primary_vendor_id, owner_vendor_id, price, currency, sales_status, billing_status, notes, created_at)
VALUES

  -- ── lead ──────────────────────────────────────────────

  -- D01: lead / pending | provider-only: Jonathan Reed | manager: Hadar Cohen
  ('d0000000-0000-0000-0000-000000000001',
   'ae85702e-58b4-4d56-873d-609780199163', -- Amit Peretz
   '8e0ae095-6f84-47d7-9b25-076c44517c70', -- Assessment & Strategy Session
   'fb1574df-9535-4cd1-b02e-80dd86ec806e', -- Jonathan Reed (primary)
   'd1d48ca9-1da8-4c42-a188-671dfeb87eb3', -- Hadar Cohen (owner/manager)
   600.00, 'EUR', 'lead', 'pending',
   'Intro call done, proposal sent', NOW() - INTERVAL '5 days'),

  -- D02: lead / pending | solo vendor: Nina Calder
  ('d0000000-0000-0000-0000-000000000002',
   'da3a7eff-399e-40bb-ac8d-968961b9d872', -- Neta Golan
   '325c4cf3-d9ca-4623-901b-44bc4ef7365f', -- 1:1 Consulting Session
   '4a99814c-df84-441e-a39c-95bd53cd4a9d', -- Nina Calder (primary)
   '4a99814c-df84-441e-a39c-95bd53cd4a9d', -- Nina Calder (owner = solo)
   250.00, 'EUR', 'lead', 'pending',
   'Referral from Liam', NOW() - INTERVAL '3 days'),

  -- ── qualified ─────────────────────────────────────────

  -- D03: qualified / pending | Maya Levi manages Jonathan Reed
  ('d0000000-0000-0000-0000-000000000003',
   '9410b757-c60d-447c-b704-63659a465452', -- Daniel Cohen
   '5408c47f-e96a-4e1c-ba54-dffd651327d7', -- Executive Coaching Package
   'fb1574df-9535-4cd1-b02e-80dd86ec806e', -- Jonathan Reed (primary)
   'bd74f13a-846b-4833-9f40-84c79987a3e9', -- Maya Levi (owner)
   3600.00, 'EUR', 'qualified', 'pending',
   'Needs sign-off from board', NOW() - INTERVAL '12 days'),

  -- D04: qualified / invoiced | solo: Ariella Bloom
  ('d0000000-0000-0000-0000-000000000004',
   '7e7f183d-1c20-44e8-8f43-1f8489ceb180', -- Ido Lavi
   'd247c635-756f-4377-be04-3b06a3e79925', -- Career Transition Package
   '8da706a5-2d53-47c9-9c96-740ef67f5398', -- Ariella Bloom (primary)
   '8da706a5-2d53-47c9-9c96-740ef67f5398', -- Ariella Bloom (owner = solo)
   2400.00, 'EUR', 'qualified', 'invoiced',
   'Invoice sent, waiting on payment', NOW() - INTERVAL '10 days'),

  -- ── active ────────────────────────────────────────────

  -- D05: active / partial | Hadar manages Eyal Mor | PACKAGE: 20 sessions, 8 used
  ('d0000000-0000-0000-0000-000000000005',
   '26c0b058-501a-4514-b695-4b2a0d944032', -- Dana Weiss (corporate proxy)
   '84eb96f5-8728-49a0-8651-b837938dd473', -- Leadership Development Program
   '490f2c6d-8f94-4f45-b778-3fc9f492c555', -- Eyal Mor (primary)
   'd1d48ca9-1da8-4c42-a188-671dfeb87eb3', -- Hadar Cohen (owner)
   6000.00, 'EUR', 'active', 'partial',
   'Corporate engagement, 20-session program', NOW() - INTERVAL '60 days'),

  -- D06: active / partial | Maya Levi both manager and provider | PACKAGE: 10 sessions, 3 used
  ('d0000000-0000-0000-0000-000000000006',
   '88fe8163-460f-4ebd-891e-6283c940563e', -- Hila Mor
   '5408c47f-e96a-4e1c-ba54-dffd651327d7', -- Executive Coaching Package
   'bd74f13a-846b-4833-9f40-84c79987a3e9', -- Maya Levi (primary)
   'bd74f13a-846b-4833-9f40-84c79987a3e9', -- Maya Levi (owner = solo)
   3600.00, 'EUR', 'active', 'partial',
   'Started January, good progress', NOW() - INTERVAL '70 days'),

  -- D07: active / pending | Ariella Bloom solo | PACKAGE: 8 sessions, 7 used (nearly depleted)
  ('d0000000-0000-0000-0000-000000000007',
   '3f7305f1-b260-45d0-be72-8cf26aec4415', -- Lior Katz
   'd247c635-756f-4377-be04-3b06a3e79925', -- Career Transition Package
   '8da706a5-2d53-47c9-9c96-740ef67f5398', -- Ariella Bloom
   '8da706a5-2d53-47c9-9c96-740ef67f5398',
   2400.00, 'EUR', 'active', 'pending',
   'Nearly done, discuss renewal', NOW() - INTERVAL '55 days'),

  -- D08: active / pending | Eyal Mor solo | pay-per-session (no package)
  ('d0000000-0000-0000-0000-000000000008',
   '4120f18f-5fb0-4ae9-ac5e-c6b472d7d169', -- Maya Shalev
   '325c4cf3-d9ca-4623-901b-44bc4ef7365f', -- 1:1 Consulting Session
   '490f2c6d-8f94-4f45-b778-3fc9f492c555', -- Eyal Mor
   '490f2c6d-8f94-4f45-b778-3fc9f492c555',
   250.00, 'EUR', 'active', 'pending',
   'Pay-per-session, ongoing advisory', NOW() - INTERVAL '20 days'),

  -- D09: active / invoiced | Jonathan Reed primary, Maya Levi owner | PACKAGE: 10 sessions, 5 used
  ('d0000000-0000-0000-0000-000000000009',
   'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', -- Omer Haddad
   '5408c47f-e96a-4e1c-ba54-dffd651327d7', -- Executive Coaching Package
   'fb1574df-9535-4cd1-b02e-80dd86ec806e', -- Jonathan Reed
   'bd74f13a-846b-4833-9f40-84c79987a3e9', -- Maya Levi
   3600.00, 'EUR', 'active', 'invoiced',
   NULL, NOW() - INTERVAL '45 days'),

  -- D10: active / overdue | Shani Katz solo | PACKAGE: 10 sessions, 2 used
  ('d0000000-0000-0000-0000-000000000010',
   '583267d6-4223-4c03-9023-ee350e8b6ce9', -- Tali Yosef
   '5408c47f-e96a-4e1c-ba54-dffd651327d7', -- Executive Coaching Package
   'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', -- Shani Katz
   'b48713ca-dc11-4f3e-a1ae-9f7c5d497481',
   3600.00, 'EUR', 'active', 'overdue',
   'Payment 30 days overdue, chasing client', NOW() - INTERVAL '50 days'),

  -- D11: active / pending | Liam Porter solo | pay-per-session
  ('d0000000-0000-0000-0000-000000000011',
   '936987d4-87c5-4350-9327-1433853e6bc5', -- Yuval Dahan
   '325c4cf3-d9ca-4623-901b-44bc4ef7365f', -- 1:1 Consulting Session
   '06c21041-f45f-48ac-968e-158029538ad0', -- Liam Porter
   '06c21041-f45f-48ac-968e-158029538ad0',
   250.00, 'EUR', 'active', 'pending',
   NULL, NOW() - INTERVAL '15 days'),

  -- D12: active / pending | Eyal Mor solo | 5th client (demonstrates 5+ clients)
  ('d0000000-0000-0000-0000-000000000012',
   'b06d122d-c4a7-44cb-bb70-da63b55fb4e0', -- Shira Ben David
   '325c4cf3-d9ca-4623-901b-44bc4ef7365f',
   '490f2c6d-8f94-4f45-b778-3fc9f492c555', -- Eyal Mor
   '490f2c6d-8f94-4f45-b778-3fc9f492c555',
   250.00, 'EUR', 'active', 'pending',
   NULL, NOW() - INTERVAL '18 days'),

  -- D13: active / pending | Eyal Mor 6th client
  ('d0000000-0000-0000-0000-000000000013',
   'c67bcf42-e468-46f6-b48c-58250bff6803', -- Noa Levi
   '325c4cf3-d9ca-4623-901b-44bc4ef7365f',
   '490f2c6d-8f94-4f45-b778-3fc9f492c555', -- Eyal Mor
   '490f2c6d-8f94-4f45-b778-3fc9f492c555',
   250.00, 'EUR', 'active', 'pending',
   NULL, NOW() - INTERVAL '22 days'),

  -- ── delivered ─────────────────────────────────────────

  -- D14: delivered / paid | Ariella Bloom solo | PACKAGE: 10 sessions, 10 used (COMPLETED)
  ('d0000000-0000-0000-0000-000000000014',
   '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', -- Roni Sasson
   '5408c47f-e96a-4e1c-ba54-dffd651327d7', -- Executive Coaching Package
   '8da706a5-2d53-47c9-9c96-740ef67f5398', -- Ariella Bloom
   '8da706a5-2d53-47c9-9c96-740ef67f5398',
   3600.00, 'EUR', 'delivered', 'paid',
   'Completed full package', NOW() - INTERVAL '90 days'),

  -- D15: delivered / paid | Jonathan Reed solo | no package
  ('d0000000-0000-0000-0000-000000000015',
   'def0f8b5-4f13-4f4f-9f2a-57389500427e', -- Adi Regev
   '8e0ae095-6f84-47d7-9b25-076c44517c70', -- Assessment & Strategy Session
   'fb1574df-9535-4cd1-b02e-80dd86ec806e', -- Jonathan Reed
   'fb1574df-9535-4cd1-b02e-80dd86ec806e',
   600.00, 'EUR', 'delivered', 'paid',
   'One-off assessment, all done', NOW() - INTERVAL '80 days'),

  -- D16: delivered / invoiced | Shani Katz primary, Hadar manager | PACKAGE: 8 sessions, 8 used
  ('d0000000-0000-0000-0000-000000000016',
   '1dea8b0b-0a3d-41e3-8760-adb712a07084', -- Tamar Avraham
   'd247c635-756f-4377-be04-3b06a3e79925', -- Career Transition Package
   'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', -- Shani Katz
   'd1d48ca9-1da8-4c42-a188-671dfeb87eb3', -- Hadar Cohen
   2400.00, 'EUR', 'delivered', 'invoiced',
   'Delivered, invoice sent', NOW() - INTERVAL '75 days'),

  -- D17: delivered / partial | Maya Levi solo | PACKAGE: 10 sessions, 10 used
  ('d0000000-0000-0000-0000-000000000017',
   '3db6ef27-8205-4517-92f9-7ce8464a92ac', -- Yael Mizrahi
   '5408c47f-e96a-4e1c-ba54-dffd651327d7',
   'bd74f13a-846b-4833-9f40-84c79987a3e9', -- Maya Levi
   'bd74f13a-846b-4833-9f40-84c79987a3e9',
   3600.00, 'EUR', 'delivered', 'partial',
   'First instalment received, second pending', NOW() - INTERVAL '85 days'),

  -- D18: delivered / overdue | Eyal Mor solo | no package
  ('d0000000-0000-0000-0000-000000000018',
   '90c4ff59-2e75-4c28-8263-4c52a4215f5d', -- Itay Sharabi
   '8e0ae095-6f84-47d7-9b25-076c44517c70', -- Assessment & Strategy Session
   '490f2c6d-8f94-4f45-b778-3fc9f492c555', -- Eyal Mor
   '490f2c6d-8f94-4f45-b778-3fc9f492c555',
   600.00, 'EUR', 'delivered', 'overdue',
   'Client ghosting on payment', NOW() - INTERVAL '70 days'),

  -- ── closed ────────────────────────────────────────────

  -- D19: closed / paid | Jonathan Reed primary, Hadar manager | no package
  ('d0000000-0000-0000-0000-000000000019',
   '7de6b93b-81ae-4c1c-90c4-c8bbe060aca2', -- Gal Biton
   '325c4cf3-d9ca-4623-901b-44bc4ef7365f', -- 1:1 Consulting Session
   'fb1574df-9535-4cd1-b02e-80dd86ec806e', -- Jonathan Reed
   'd1d48ca9-1da8-4c42-a188-671dfeb87eb3', -- Hadar Cohen
   250.00, 'EUR', 'closed', 'paid',
   NULL, NOW() - INTERVAL '100 days'),

  -- D20: closed / paid | Nina Calder solo | no package (her completed deal)
  ('d0000000-0000-0000-0000-000000000020',
   '05a8cfa9-8764-46ca-b27d-a7bc6edf3c34', -- Nir Asulin
   '325c4cf3-d9ca-4623-901b-44bc4ef7365f',
   '4a99814c-df84-441e-a39c-95bd53cd4a9d', -- Nina Calder
   '4a99814c-df84-441e-a39c-95bd53cd4a9d',
   250.00, 'EUR', 'closed', 'paid',
   NULL, NOW() - INTERVAL '95 days'),

  -- D21: closed / paid | Liam Porter, Hadar manager | Workshop (no package)
  ('d0000000-0000-0000-0000-000000000021',
   'bd1f3090-a27a-4113-9171-5694e79c251d', -- Sivan Naim
   'e27cded5-df26-48bc-b7e2-4767a4ec9a81', -- Group Workshop
   '06c21041-f45f-48ac-968e-158029538ad0', -- Liam Porter
   'd1d48ca9-1da8-4c42-a188-671dfeb87eb3', -- Hadar Cohen
   1200.00, 'EUR', 'closed', 'paid',
   'Workshop delivered to team of 8', NOW() - INTERVAL '110 days'),

  -- D22: closed / paid | Ariella Bloom solo | 2nd client shared with Eyal Mor
  ('d0000000-0000-0000-0000-000000000022',
   '286571d6-171e-4399-97f8-8738e01c846a', -- Michal Fridman (worked with Eyal too → D23)
   'd247c635-756f-4377-be04-3b06a3e79925', -- Career Transition Package
   '8da706a5-2d53-47c9-9c96-740ef67f5398', -- Ariella Bloom
   '8da706a5-2d53-47c9-9c96-740ef67f5398',
   2400.00, 'EUR', 'closed', 'paid',
   'Completed career transition program', NOW() - INTERVAL '120 days'),

  -- D23: closed / paid | Eyal Mor solo | same client Michal Fridman (handoff scenario)
  ('d0000000-0000-0000-0000-000000000023',
   '286571d6-171e-4399-97f8-8738e01c846a', -- Michal Fridman (was with Ariella first)
   '325c4cf3-d9ca-4623-901b-44bc4ef7365f', -- 1:1 Consulting Session
   '490f2c6d-8f94-4f45-b778-3fc9f492c555', -- Eyal Mor
   '490f2c6d-8f94-4f45-b778-3fc9f492c555',
   250.00, 'EUR', 'closed', 'paid',
   'Follow-up consulting after coaching program', NOW() - INTERVAL '60 days'),

  -- D24: closed / paid | Shani Katz solo | no package
  ('d0000000-0000-0000-0000-000000000024',
   'dd518fb7-c298-4dbe-98c8-889877856cfa', -- Yarden Bar
   '8e0ae095-6f84-47d7-9b25-076c44517c70', -- Assessment Session
   'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', -- Shani Katz
   'b48713ca-dc11-4f3e-a1ae-9f7c5d497481',
   600.00, 'EUR', 'closed', 'paid',
   NULL, NOW() - INTERVAL '105 days'),

  -- D25: closed / paid | Maya Levi solo | Custom project
  ('d0000000-0000-0000-0000-000000000025',
   'eca0af63-5980-41c7-9db4-d96d3fb0f73e', -- Omri Bashan
   '5d291e19-ff81-40ca-b431-aa3179172f5e', -- Custom Consulting Project
   'bd74f13a-846b-4833-9f40-84c79987a3e9', -- Maya Levi
   'bd74f13a-846b-4833-9f40-84c79987a3e9',
   5000.00, 'EUR', 'closed', 'paid',
   'Custom org design project', NOW() - INTERVAL '130 days');

-- ============================================
-- PACKAGES
-- (only for deals with package-type products)
-- ============================================

INSERT INTO packages (id, deal_id, client_id, vendor_id, total_sessions, sessions_used, status, created_at)
VALUES

  -- P01: D05 Leadership Dev — active, 8/20 used
  ('b0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000005',
   '26c0b058-501a-4514-b695-4b2a0d944032', -- Dana Weiss
   '490f2c6d-8f94-4f45-b778-3fc9f492c555', -- Eyal Mor
   20, 8, 'active', NOW() - INTERVAL '60 days'),

  -- P02: D06 Executive Coaching — active, 3/10 used
  ('b0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000006',
   '88fe8163-460f-4ebd-891e-6283c940563e', -- Hila Mor
   'bd74f13a-846b-4833-9f40-84c79987a3e9', -- Maya Levi
   10, 3, 'active', NOW() - INTERVAL '70 days'),

  -- P03: D07 Career Transition — active, 7/8 used (nearly depleted)
  ('b0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000007',
   '3f7305f1-b260-45d0-be72-8cf26aec4415', -- Lior Katz
   '8da706a5-2d53-47c9-9c96-740ef67f5398', -- Ariella Bloom
   8, 7, 'active', NOW() - INTERVAL '55 days'),

  -- P04: D09 Executive Coaching — active, 5/10 used
  ('b0000000-0000-0000-0000-000000000004',
   'd0000000-0000-0000-0000-000000000009',
   'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', -- Omer Haddad
   'fb1574df-9535-4cd1-b02e-80dd86ec806e', -- Jonathan Reed
   10, 5, 'active', NOW() - INTERVAL '45 days'),

  -- P05: D10 Executive Coaching — active, 2/10 used
  ('b0000000-0000-0000-0000-000000000005',
   'd0000000-0000-0000-0000-000000000010',
   '583267d6-4223-4c03-9023-ee350e8b6ce9', -- Tali Yosef
   'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', -- Shani Katz
   10, 2, 'active', NOW() - INTERVAL '50 days'),

  -- P06: D14 Executive Coaching — COMPLETED, 10/10 used
  ('b0000000-0000-0000-0000-000000000006',
   'd0000000-0000-0000-0000-000000000014',
   '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', -- Roni Sasson
   '8da706a5-2d53-47c9-9c96-740ef67f5398', -- Ariella Bloom
   10, 10, 'completed', NOW() - INTERVAL '90 days'),

  -- P07: D16 Career Transition — COMPLETED, 8/8 used
  ('b0000000-0000-0000-0000-000000000007',
   'd0000000-0000-0000-0000-000000000016',
   '1dea8b0b-0a3d-41e3-8760-adb712a07084', -- Tamar Avraham
   'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', -- Shani Katz
   8, 8, 'completed', NOW() - INTERVAL '75 days'),

  -- P08: D17 Executive Coaching — COMPLETED, 10/10 used
  ('b0000000-0000-0000-0000-000000000008',
   'd0000000-0000-0000-0000-000000000017',
   '3db6ef27-8205-4517-92f9-7ce8464a92ac', -- Yael Mizrahi
   'bd74f13a-846b-4833-9f40-84c79987a3e9', -- Maya Levi
   10, 10, 'completed', NOW() - INTERVAL '85 days'),

  -- P09: D22 Career Transition — COMPLETED, 8/8 used (Ariella / Michal Fridman)
  ('b0000000-0000-0000-0000-000000000009',
   'd0000000-0000-0000-0000-000000000022',
   '286571d6-171e-4399-97f8-8738e01c846a', -- Michal Fridman
   '8da706a5-2d53-47c9-9c96-740ef67f5398', -- Ariella Bloom
   8, 8, 'completed', NOW() - INTERVAL '120 days');

-- ============================================
-- SESSIONS (~75 total, all scenarios covered)
-- ============================================

INSERT INTO sessions (deal_id, vendor_id, client_id, package_id, session_date, duration_min, session_type, status, billed, bill_id, notes)
VALUES

  -- ================================================================
  -- ARIELLA BLOOM (8da706a5)
  -- Bill history: bill-paid (a5), current unbilled
  -- ================================================================

  -- Completed package D14 / P06 — sessions in PAID bill (a5)
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2025-12-01', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2025-12-08', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2025-12-15', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2025-12-22', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2026-01-05', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2026-01-12', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2026-01-19', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2026-01-26', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000014', '8da706a5-2d53-47c9-9c96-740ef67f5398', '893c16c3-ad2d-4aa9-8ac2-7ec34a9d20bf', 'b0000000-0000-0000-0000-000000000006', '2026-02-02', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', 'Closing session — great progress'),

  -- Package D22 / P09 — Michal Fridman (completed, paid bill a5)
  ('d0000000-0000-0000-0000-000000000022', '8da706a5-2d53-47c9-9c96-740ef67f5398', '286571d6-171e-4399-97f8-8738e01c846a', 'b0000000-0000-0000-0000-000000000009', '2025-10-06', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),
  ('d0000000-0000-0000-0000-000000000022', '8da706a5-2d53-47c9-9c96-740ef67f5398', '286571d6-171e-4399-97f8-8738e01c846a', 'b0000000-0000-0000-0000-000000000009', '2025-10-20', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000005', NULL),

  -- Active D07 / P03 — Lior Katz (7 used, 1 more available) — UNBILLED
  ('d0000000-0000-0000-0000-000000000007', '8da706a5-2d53-47c9-9c96-740ef67f5398', '3f7305f1-b260-45d0-be72-8cf26aec4415', 'b0000000-0000-0000-0000-000000000003', '2026-02-10', 60, 'coaching', 'done', false, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000007', '8da706a5-2d53-47c9-9c96-740ef67f5398', '3f7305f1-b260-45d0-be72-8cf26aec4415', 'b0000000-0000-0000-0000-000000000003', '2026-02-24', 60, 'coaching', 'done', false, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000007', '8da706a5-2d53-47c9-9c96-740ef67f5398', '3f7305f1-b260-45d0-be72-8cf26aec4415', 'b0000000-0000-0000-0000-000000000003', '2026-03-10', 60, 'coaching', 'done', false, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000007', '8da706a5-2d53-47c9-9c96-740ef67f5398', '3f7305f1-b260-45d0-be72-8cf26aec4415', 'b0000000-0000-0000-0000-000000000003', '2026-03-24', 60, 'coaching', 'done', false, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000007', '8da706a5-2d53-47c9-9c96-740ef67f5398', '3f7305f1-b260-45d0-be72-8cf26aec4415', 'b0000000-0000-0000-0000-000000000003', '2026-04-07', 60, 'coaching', 'done', false, NULL, 'Discussed renewal'),
  -- PLANNED future session for D07
  ('d0000000-0000-0000-0000-000000000007', '8da706a5-2d53-47c9-9c96-740ef67f5398', '3f7305f1-b260-45d0-be72-8cf26aec4415', 'b0000000-0000-0000-0000-000000000003', '2026-04-14', 60, 'coaching', 'planned', false, NULL, 'Final session of package'),

  -- ================================================================
  -- JONATHAN REED (fb1574df)
  -- Bill history: bill-paid (a6), bill-submitted (a7)
  -- ================================================================

  -- D15 closed/paid — single assessment session, in paid bill a6
  ('d0000000-0000-0000-0000-000000000015', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', 'def0f8b5-4f13-4f4f-9f2a-57389500427e', NULL, '2025-11-10', 90, 'consulting', 'done', true,  'a1000000-0000-0000-0000-000000000006', NULL),

  -- D19 closed/paid — in paid bill a6
  ('d0000000-0000-0000-0000-000000000019', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', '7de6b93b-81ae-4c1c-90c4-c8bbe060aca2', NULL, '2025-11-20', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000006', NULL),
  ('d0000000-0000-0000-0000-000000000019', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', '7de6b93b-81ae-4c1c-90c4-c8bbe060aca2', NULL, '2025-12-01', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000006', NULL),

  -- D09 active / P04 — Omer Haddad (5 used), in submitted bill a7
  ('d0000000-0000-0000-0000-000000000009', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', 'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', 'b0000000-0000-0000-0000-000000000004', '2026-02-03', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000007', NULL),
  ('d0000000-0000-0000-0000-000000000009', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', 'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', 'b0000000-0000-0000-0000-000000000004', '2026-02-17', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000007', NULL),
  ('d0000000-0000-0000-0000-000000000009', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', 'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', 'b0000000-0000-0000-0000-000000000004', '2026-03-03', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000007', NULL),
  ('d0000000-0000-0000-0000-000000000009', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', 'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', 'b0000000-0000-0000-0000-000000000004', '2026-03-17', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000007', NULL),
  ('d0000000-0000-0000-0000-000000000009', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', 'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', 'b0000000-0000-0000-0000-000000000004', '2026-03-31', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000007', NULL),
  -- PLANNED future sessions D09
  ('d0000000-0000-0000-0000-000000000009', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', 'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', 'b0000000-0000-0000-0000-000000000004', '2026-04-14', 60, 'coaching', 'planned', false, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000009', 'fb1574df-9535-4cd1-b02e-80dd86ec806e', 'b4b41c96-c40c-47ba-9fdd-a3e7e8546fe2', 'b0000000-0000-0000-0000-000000000004', '2026-04-28', 60, 'coaching', 'planned', false, NULL, NULL),

  -- ================================================================
  -- EYAL MOR (490f2c6d)
  -- Bill: submitted (a2). Many clients demonstrates 5+ client scenario.
  -- ================================================================

  -- D05 / P01 Leadership Dev — Dana Weiss (8 sessions used) — in submitted bill a2
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-01-07', 90, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000002', NULL),
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-01-21', 90, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000002', NULL),
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-02-04', 90, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000002', NULL),
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-02-18', 90, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000002', NULL),
  -- No-show for Dana
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-02-25', 90, 'coaching', 'no_show', false, NULL, 'Client no-show, rescheduled'),
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-03-04', 90, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000002', NULL),
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-03-18', 90, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000002', NULL),
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-04-01', 90, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000002', NULL),
  -- Planned future sessions D05
  ('d0000000-0000-0000-0000-000000000005', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '26c0b058-501a-4514-b695-4b2a0d944032', 'b0000000-0000-0000-0000-000000000001', '2026-04-15', 90, 'coaching', 'planned', false, NULL, NULL),

  -- D08 pay-per-session — Maya Shalev — UNBILLED
  ('d0000000-0000-0000-0000-000000000008', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '4120f18f-5fb0-4ae9-ac5e-c6b472d7d169', NULL, '2026-03-06', 60, 'consulting', 'done', false, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000008', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '4120f18f-5fb0-4ae9-ac5e-c6b472d7d169', NULL, '2026-03-20', 60, 'consulting', 'done', false, NULL, NULL),
  -- Cancelled session
  ('d0000000-0000-0000-0000-000000000008', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '4120f18f-5fb0-4ae9-ac5e-c6b472d7d169', NULL, '2026-03-27', 60, 'consulting', 'cancelled', false, NULL, 'Client cancelled last minute'),

  -- D12 Shira Ben David — UNBILLED
  ('d0000000-0000-0000-0000-000000000012', '490f2c6d-8f94-4f45-b778-3fc9f492c555', 'b06d122d-c4a7-44cb-bb70-da63b55fb4e0', NULL, '2026-03-10', 60, 'consulting', 'done', false, NULL, NULL),

  -- D13 Noa Levi — UNBILLED
  ('d0000000-0000-0000-0000-000000000013', '490f2c6d-8f94-4f45-b778-3fc9f492c555', 'c67bcf42-e468-46f6-b48c-58250bff6803', NULL, '2026-03-12', 60, 'consulting', 'done', false, NULL, NULL),

  -- D18 Itay Sharabi — delivered/overdue — UNBILLED
  ('d0000000-0000-0000-0000-000000000018', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '90c4ff59-2e75-4c28-8263-4c52a4215f5d', NULL, '2026-01-15', 90, 'consulting', 'done', false, NULL, 'Assessment delivered, payment overdue'),

  -- D23 Michal Fridman (handoff from Ariella) — UNBILLED
  ('d0000000-0000-0000-0000-000000000023', '490f2c6d-8f94-4f45-b778-3fc9f492c555', '286571d6-171e-4399-97f8-8738e01c846a', NULL, '2026-02-05', 60, 'consulting', 'done', false, NULL, 'Follow-up from coaching program'),

  -- ================================================================
  -- MAYA LEVI (bd74f13a)
  -- Bill: draft (a1). Manager AND provider.
  -- ================================================================

  -- D06 / P02 Executive Coaching — Hila Mor (3 sessions) — in draft bill a1
  ('d0000000-0000-0000-0000-000000000006', 'bd74f13a-846b-4833-9f40-84c79987a3e9', '88fe8163-460f-4ebd-891e-6283c940563e', 'b0000000-0000-0000-0000-000000000002', '2026-01-13', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000001', NULL),
  ('d0000000-0000-0000-0000-000000000006', 'bd74f13a-846b-4833-9f40-84c79987a3e9', '88fe8163-460f-4ebd-891e-6283c940563e', 'b0000000-0000-0000-0000-000000000002', '2026-02-10', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000001', NULL),
  ('d0000000-0000-0000-0000-000000000006', 'bd74f13a-846b-4833-9f40-84c79987a3e9', '88fe8163-460f-4ebd-891e-6283c940563e', 'b0000000-0000-0000-0000-000000000002', '2026-03-10', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000001', NULL),
  -- Planned D06
  ('d0000000-0000-0000-0000-000000000006', 'bd74f13a-846b-4833-9f40-84c79987a3e9', '88fe8163-460f-4ebd-891e-6283c940563e', 'b0000000-0000-0000-0000-000000000002', '2026-04-07', 60, 'coaching', 'planned', false, NULL, NULL),

  -- D17 Yael Mizrahi — completed package P08 — UNBILLED (partial billing scenario)
  ('d0000000-0000-0000-0000-000000000017', 'bd74f13a-846b-4833-9f40-84c79987a3e9', '3db6ef27-8205-4517-92f9-7ce8464a92ac', 'b0000000-0000-0000-0000-000000000008', '2025-10-01', 60, 'coaching', 'done', false, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000017', 'bd74f13a-846b-4833-9f40-84c79987a3e9', '3db6ef27-8205-4517-92f9-7ce8464a92ac', 'b0000000-0000-0000-0000-000000000008', '2025-10-15', 60, 'coaching', 'done', false, NULL, NULL),

  -- D25 Omri Bashan — custom project — UNBILLED
  ('d0000000-0000-0000-0000-000000000025', 'bd74f13a-846b-4833-9f40-84c79987a3e9', 'eca0af63-5980-41c7-9db4-d96d3fb0f73e', NULL, '2025-09-15', 120, 'consulting', 'done', false, NULL, 'Org design workshop'),
  ('d0000000-0000-0000-0000-000000000025', 'bd74f13a-846b-4833-9f40-84c79987a3e9', 'eca0af63-5980-41c7-9db4-d96d3fb0f73e', NULL, '2025-09-29', 120, 'consulting', 'done', false, NULL, 'Follow-up strategy session'),

  -- ================================================================
  -- SHANI KATZ (b48713ca)
  -- Bill: returned (a3). Fix and resubmit scenario.
  -- ================================================================

  -- D16 Tamar Avraham / P07 completed — sessions in returned bill a3
  ('d0000000-0000-0000-0000-000000000016', 'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', '1dea8b0b-0a3d-41e3-8760-adb712a07084', 'b0000000-0000-0000-0000-000000000007', '2025-11-03', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000003', NULL),
  ('d0000000-0000-0000-0000-000000000016', 'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', '1dea8b0b-0a3d-41e3-8760-adb712a07084', 'b0000000-0000-0000-0000-000000000007', '2025-11-17', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000003', NULL),
  ('d0000000-0000-0000-0000-000000000016', 'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', '1dea8b0b-0a3d-41e3-8760-adb712a07084', 'b0000000-0000-0000-0000-000000000007', '2025-12-01', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000003', NULL),
  ('d0000000-0000-0000-0000-000000000016', 'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', '1dea8b0b-0a3d-41e3-8760-adb712a07084', 'b0000000-0000-0000-0000-000000000007', '2025-12-15', 60, 'coaching', 'done', true,  'a1000000-0000-0000-0000-000000000003', NULL),

  -- D10 Tali Yosef / P05 — 2 sessions used — UNBILLED
  ('d0000000-0000-0000-0000-000000000010', 'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', '583267d6-4223-4c03-9023-ee350e8b6ce9', 'b0000000-0000-0000-0000-000000000005', '2026-02-06', 60, 'coaching', 'done', false, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000010', 'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', '583267d6-4223-4c03-9023-ee350e8b6ce9', 'b0000000-0000-0000-0000-000000000005', '2026-02-20', 60, 'coaching', 'done', false, NULL, NULL),
  -- Planned future D10
  ('d0000000-0000-0000-0000-000000000010', 'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', '583267d6-4223-4c03-9023-ee350e8b6ce9', 'b0000000-0000-0000-0000-000000000005', '2026-04-10', 60, 'coaching', 'planned', false, NULL, NULL),

  -- D24 Yarden Bar — UNBILLED (closed/paid deal, vendor session unbilled for history)
  ('d0000000-0000-0000-0000-000000000024', 'b48713ca-dc11-4f3e-a1ae-9f7c5d497481', 'dd518fb7-c298-4dbe-98c8-889877856cfa', NULL, '2025-10-08', 90, 'coaching', 'done', false, NULL, 'Assessment completed'),

  -- ================================================================
  -- LIAM PORTER (06c21041)
  -- Bill: approved (a4), awaiting payment.
  -- ================================================================

  -- D11 Yuval Dahan — in approved bill a4
  ('d0000000-0000-0000-0000-000000000011', '06c21041-f45f-48ac-968e-158029538ad0', '936987d4-87c5-4350-9327-1433853e6bc5', NULL, '2026-02-12', 90, 'consulting', 'done', true,  'a1000000-0000-0000-0000-000000000004', NULL),
  ('d0000000-0000-0000-0000-000000000011', '06c21041-f45f-48ac-968e-158029538ad0', '936987d4-87c5-4350-9327-1433853e6bc5', NULL, '2026-02-26', 90, 'consulting', 'done', true,  'a1000000-0000-0000-0000-000000000004', NULL),
  ('d0000000-0000-0000-0000-000000000011', '06c21041-f45f-48ac-968e-158029538ad0', '936987d4-87c5-4350-9327-1433853e6bc5', NULL, '2026-03-12', 90, 'consulting', 'done', true,  'a1000000-0000-0000-0000-000000000004', 'Final strategy session'),

  -- D21 Sivan Naim — group workshop — no bill (closed/paid, Liam was provider)
  ('d0000000-0000-0000-0000-000000000021', '06c21041-f45f-48ac-968e-158029538ad0', 'bd1f3090-a27a-4113-9171-5694e79c251d', NULL, '2025-09-20', 180, 'other', 'done', false, NULL, 'Group workshop — 8 participants'),

  -- ================================================================
  -- NINA CALDER (4a99814c)
  -- New vendor, 1 client (simple case).
  -- ================================================================

  -- D02 lead/pending — planned session
  ('d0000000-0000-0000-0000-000000000002', '4a99814c-df84-441e-a39c-95bd53cd4a9d', 'da3a7eff-399e-40bb-ac8d-968961b9d872', NULL, '2026-04-09', 60, 'consulting', 'planned', false, NULL, 'Discovery call'),

  -- D20 closed/paid — Nina's first delivered session
  ('d0000000-0000-0000-0000-000000000020', '4a99814c-df84-441e-a39c-95bd53cd4a9d', '05a8cfa9-8764-46ca-b27d-a7bc6edf3c34', NULL, '2025-12-10', 60, 'consulting', 'done', false, NULL, NULL);

-- ============================================
-- VENDOR_CLIENTS (junction — auto-create from sessions)
-- ============================================

INSERT INTO vendor_clients (vendor_id, client_id)
SELECT DISTINCT s.vendor_id, s.client_id
FROM sessions s
WHERE s.vendor_id IS NOT NULL
  AND s.client_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Bills by status (expect: draft×1, submitted×2, returned×1, approved×1, paid×2)
-- SELECT status, count(*) FROM bills GROUP BY status ORDER BY status;

-- Sessions by billing state
-- SELECT billed, (bill_id IS NOT NULL) as has_bill_id, count(*) FROM sessions GROUP BY billed, has_bill_id ORDER BY billed;

-- Sessions by status (expect: planned, done, cancelled, no_show all present)
-- SELECT status, count(*) FROM sessions GROUP BY status ORDER BY status;

-- Packages by status (expect: active×4+, completed×3+)
-- SELECT status, count(*) FROM packages GROUP BY status ORDER BY status;

-- Deals by sales_status (expect all 5 statuses covered)
-- SELECT sales_status, count(*) FROM deals GROUP BY sales_status ORDER BY sales_status;

-- Deals by billing_status (expect all 5 statuses covered)
-- SELECT billing_status, count(*) FROM deals GROUP BY billing_status ORDER BY billing_status;

-- Vendor client counts (Eyal Mor should have 6+)
-- SELECT v.full_name, count(vc.client_id) as clients
-- FROM vendors v JOIN vendor_clients vc ON vc.vendor_id = v.id
-- GROUP BY v.full_name ORDER BY clients DESC;

-- Client multi-vendor (Michal Fridman should appear twice)
-- SELECT c.full_name, count(vc.vendor_id) as vendor_count
-- FROM clients c JOIN vendor_clients vc ON vc.client_id = c.id
-- GROUP BY c.full_name HAVING count(vc.vendor_id) > 1;

-- Orphan check (must be 0)
-- SELECT count(*) as orphans FROM sessions s
-- WHERE NOT EXISTS (
--   SELECT 1 FROM vendor_clients vc
--   WHERE vc.vendor_id = s.vendor_id AND vc.client_id = s.client_id
-- );
