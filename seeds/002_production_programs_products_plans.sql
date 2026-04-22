-- ================================================================
-- Seed: Programs, Products, Plans, Product Plans
-- Source: "plans and products 4-2026/Sheet 2-Table 1.csv"
-- Target: Production database
-- Rules:
--   - Rows with blank `program` are skipped
--   - collection_gateway = 'thrivecart' for all rows
--   - collection_gateway_product_id = product_id (ThriveCart numeric ID)
--   - Safe to re-run (INSERT ... ON CONFLICT DO NOTHING)
-- ================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. PROGRAMS
-- ────────────────────────────────────────────────────────────────
INSERT INTO programs (id, name, slug, active) VALUES
  (gen_random_uuid(), 'Beyond',               'beyond',               true),
  (gen_random_uuid(), 'chat',                 'chat',                 true),
  (gen_random_uuid(), 'Coaching',             'coaching',             true),
  (gen_random_uuid(), 'Fluency Festival VIP', 'fluency-festival-vip', true),
  (gen_random_uuid(), 'Grammar Master',       'grammar-master',       true),
  (gen_random_uuid(), 'HPW',                  'hpw',                  true),
  (gen_random_uuid(), 'Mindset',              'mindset',              true),
  (gen_random_uuid(), 'new sound',            'new-sound',            true),
  (gen_random_uuid(), 'Sprint',               'sprint',               true)
ON CONFLICT (slug) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 2. PRODUCTS
-- One product per distinct (program, product-name) pair
-- ────────────────────────────────────────────────────────────────
INSERT INTO products (id, program_id, name, active)
SELECT
  gen_random_uuid(),
  p.id,
  v.product_name,
  true
FROM (VALUES
  ('Beyond',               'Beyond'),
  ('chat',                 'chat'),
  ('Coaching',             'Coaching'),
  ('Coaching',             'Coaching - packages'),
  ('Fluency Festival VIP', 'Fluency Festival VIP'),
  ('Grammar Master',       'Grammar Master'),
  ('HPW',                  'HPW'),
  ('Mindset',              'Mindset'),
  ('new sound',            'new sound'),
  ('new sound',            'new sound feedback'),
  ('new sound',            'new sound feedback LE'),
  ('new sound',            'new sound LE'),
  ('new sound',            'new sound POD'),
  ('new sound',            'new sound VIP'),
  ('new sound',            'new sound VIP LE'),
  ('Sprint',               'Sprint')
) AS v(program_name, product_name)
JOIN programs p ON p.name = v.program_name
WHERE NOT EXISTS (
  SELECT 1 FROM products pr
  JOIN programs pg ON pg.id = pr.program_id
  WHERE pg.name = v.program_name AND pr.name = v.product_name
);

-- ────────────────────────────────────────────────────────────────
-- 3. PLANS
-- ────────────────────────────────────────────────────────────────
INSERT INTO plans (id, product_id, name, payment_type, installments_count, amount, currency, payment_rail, payment_link_url, external_id, active)
SELECT
  gen_random_uuid(),
  pr.id,
  v.plan_name,
  v.payment_type,
  v.installments_count,
  v.amount,
  'USD',
  'thrivecart',
  v.payment_link_url,
  v.external_id,
  true
FROM (VALUES
  -- Beyond
  ('Beyond', 'Beyond', 'Beyond (6 months Payment) [id240]',                  'installments', 6,  186,   'https://hadarshemesh.thrivecart.com/beyond-6m/',                               '240'),
  ('Beyond', 'Beyond', 'Beyond (6 months Payment) [id246]',                  'installments', 6,  186,   'https://hadarshemesh.thrivecart.com/beyond-6-months/',                         '246'),
  ('Beyond', 'Beyond', 'Beyond Monthly Membership',                          'subscription', 1,  37,    'https://hadarshemesh.thrivecart.com/beyond-m',                                 '1'),
  ('Beyond', 'Beyond', 'Beyond - Annual x $290 [id2]',                       'subscription', 1,  290,   'https://hadarshemesh.thrivecart.com/beyond-y/',                                '2'),
  ('Beyond', 'Beyond', 'Beyond (Monthly Payment) [id234]',                   'one-payment',  1,  7,     'https://hadarshemesh.thrivecart.com/beyond-mo/',                               '234'),
  ('Beyond', 'Beyond', 'Beyond - monthly subscription [id239]',              'one-payment',  1,  37,    'https://hadarshemesh.thrivecart.com/beyond-monthly/',                          '239'),
  ('Beyond', 'Beyond', 'Beyond – Semi-Annual Membership',                    'subscription', 1,  189,   'https://hadarshemesh.thrivecart.com/beyond-6mo/',                              '254'),
  ('Beyond', 'Beyond', 'Beyond - Monthly x $37 [p-id255]',                   'subscription', 1,  NULL,  'https://hadarshemesh.thrivecart.com/beyond-m-p-id255/',                        '255'),
  ('Beyond', 'Beyond', 'Beyond Membership (1st month FREE)',                  'subscription', 1,  0,     'https://hadarshemesh.thrivecart.com/ns-beyond-m/',                             '263'),
  ('Beyond', 'Beyond', 'Beyond [Semi-Annual Membership]',                    'subscription', 1,  185,   'https://hadarshemesh.thrivecart.com/ns-beyond-6m/',                            '264'),
  ('Beyond', 'Beyond', 'Beyond Monthly Membership (legacy)',                 'one-payment',  1,  29,    'https://hadarshemesh.thrivecart.com/beyond-m-legacy/',                         '268'),
  ('Beyond', 'Beyond', 'Beyond – Annual Membership',                         'one-payment',  1,  299,   'https://hadarshemesh.thrivecart.com/beyond-annual/',                           '285'),
  ('Beyond', 'Beyond', 'Beyond Lite Monthly Membership',                     'one-payment',  1,  0.19,  'https://hadarshemesh.thrivecart.com/go-beyond-lite/',                          '291'),
  ('Beyond', 'Beyond', 'Beyond – Annual Membership (upgraded)',               'subscription', 1,  299,   'https://hadarshemesh.thrivecart.com/beyond-annual-upgraded/',                  '293'),
  -- chat
  ('chat',   'chat',   'ChatGPT English Practice Guide',                     'one-payment',  1,  21,    'https://hadarshemesh.thrivecart.com/chat/',                                    '223'),
  -- Coaching (single sessions)
  ('Coaching', 'Coaching', '1:1 Pronunciation Sessions x 1 - $90 [id31]',   'subscription', 1,  90,    'https://hadarshemesh.thrivecart.com/coaching-session-2021/',                   '31'),
  ('Coaching', 'Coaching', '1:1 Pronunciation Sessions x 1 - $95 [id33]',   'subscription', 1,  95,    'https://hadarshemesh.thrivecart.com/coaching-session/',                        '33'),
  ('Coaching', 'Coaching', 'Fluency Session 1:1 - 5 Sessions - $250 [id100]','subscription', 1,  250,   'https://hadarshemesh.thrivecart.com/fluency-session-11x5-250/',                '100'),
  ('Coaching', 'Coaching', '1:1 Fluency Session x 1 - $50 [id130]',         'subscription', 1,  50,    'https://hadarshemesh.thrivecart.com/11-fluency-session-x1-50/',                '130'),
  ('Coaching', 'Coaching', '1:1 Fluency Session x 1 - $55 [id142]',         'one-payment',  1,  55,    'https://hadarshemesh.thrivecart.com/11-fluency-session-x1-55/',                '142'),
  ('Coaching', 'Coaching', 'Fluency Session 1:1 - 5 Sessions',               'one-payment',  1,  300,   'https://hadarshemesh.thrivecart.com/fluency-session-11x5-300/',                '195'),
  ('Coaching', 'Coaching', '1:1 Pronunciation Session x 1',                  'one-payment',  1,  115,   'https://hadarshemesh.thrivecart.com/11-pronunciation-1-session/',              '196'),
  ('Coaching', 'Coaching', '1:1 Pronunciation Session x 1 [id237]',          'one-payment',  1,  104,   'https://hadarshemesh.thrivecart.com/pronunciation-session/',                   '237'),
  -- Coaching packages
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 4 - $355 [id34]',      'subscription', 4,  355,  'https://hadarshemesh.thrivecart.com/coaching-sessions-4/',                   '34'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 5',                    'installments', 1,  520,  'https://hadarshemesh.thrivecart.com/11-pronunciation-5-sessionsx520/',       '197'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 5 -$450 [id59]',       'subscription', NULL,NULL, 'https://hadarshemesh.thrivecart.com/11-pronunciation-5-sessions/',          '59'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 5 -$450 [id163]',      'installments', 5,  90,   'https://hadarshemesh.thrivecart.com/11-pronunciation-5-sessions-90x5/',      '163'),
  ('Coaching', 'Coaching - packages', 'Speaking with Feedback 1:1 - 5 sessions',            'one-payment',  NULL,225, 'https://hadarshemesh.thrivecart.com/swf11/',                                 '247'),
  ('Coaching', 'Coaching - packages', '30 minute classes x 5',                              'one-payment',  NULL,210, 'https://hadarshemesh.thrivecart.com/30-minute-classes-x-5-210/',             '267'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 10 - $850 [id57]',     'subscription', NULL,850, 'https://hadarshemesh.thrivecart.com/pronunciation-coaching-10s/',            '57'),
  ('Coaching', 'Coaching - packages', '1:1 Fluency Session x 10 - $550',                   'one-payment',  1,  0,    'https://hadarshemesh.thrivecart.com/11-fluency-session-x10-55/',             '241'),
  ('Coaching', 'Coaching - packages', '1:1 Fluency Session x 10 Classes',                  'one-payment',  NULL,210, 'https://hadarshemesh.thrivecart.com/11-fluency-session-x10-420/',            '248'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 10 -$960 [id250]',     'one-payment',  NULL,960, 'https://hadarshemesh.thrivecart.com/11-pronunciation-sessions-x-10-960-id250/', '250'),
  ('Coaching', 'Coaching - packages', 'Speaking with Feedback 1:1 - 10 sessions',           'one-payment',  NULL,450, 'https://hadarshemesh.thrivecart.com/speaking-with-feedback-10-sessions/',    '266'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 12',                   'one-payment',  1,  1020, 'https://hadarshemesh.thrivecart.com/pronunciation-coaching-12s/',            '245'),
  -- Fluency Festival VIP
  ('Fluency Festival VIP', 'Fluency Festival VIP', 'Fluency Festival VIP',                 'one-payment',  NULL,0,   'https://hadarshemesh.thrivecart.com/festival-vip/',                          '272'),
  -- Grammar Master
  ('Grammar Master', 'Grammar Master', '4 Group Classes with Marcela',                     'one-payment',  1,  50,   'https://hadarshemesh.thrivecart.com/gswf50/',                                '244'),
  ('Grammar Master', 'Grammar Master', 'Grammar Master',                                   'one-payment',  NULL,147, 'https://hadarshemesh.thrivecart.com/grammar-master/',                        '270'),
  -- HPW
  ('HPW', 'HPW', 'Hadar''s Pronunciation Workshop - $397 [id53]',                          'subscription', NULL,397, 'https://hadarshemesh.thrivecart.com/hpw2/',                                 '53'),
  ('HPW', 'HPW', 'Hadar''s Pronunciation Workshop - $397 [id111]',                         'subscription', 1,  NULL, 'https://hadarshemesh.thrivecart.com/hpw-hm/',                               '111'),
  -- Mindset
  ('Mindset', 'Mindset', 'My English Mindset',                                             'one-payment',  1,  24.5, 'https://hadarshemesh.thrivecart.com/mindset-checkout/',                     '160'),
  ('Mindset', 'Mindset', 'My English Mindset New Year Sale 50% OFF',                       'one-payment',  NULL,49,  'https://hadarshemesh.thrivecart.com/ny-sale-mindset/',                      '249'),
  -- new sound (standard)
  ('new sound', 'new sound', 'New Sound Standard (8 Payments) 2025',                       'installments', 8,  97,   'https://hadarshemesh.thrivecart.com/new-sound-8p/',                         '69'),
  ('new sound', 'new sound', 'New Sound Standard Fall 2023 (12 Payments)',                 'installments', 12, 65,   'https://hadarshemesh.thrivecart.com/new-sound-fall-12p/',                   '80'),
  ('new sound', 'new sound', 'New Sound Program - Three Monthly Payments $97',             'installments', 3,  97,   'https://hadarshemesh.thrivecart.com/97s-3p/',                               '104'),
  ('new sound', 'new sound', 'New Sound Feedback Fall 2023 (8 Payments)',                  'installments', 8,  149,  'https://hadarshemesh.thrivecart.com/new-sound-feedback-8p/',                '168'),
  ('new sound', 'new sound', 'New Sound Core (3p) 2025',                                   'installments', 3,  149,  'https://hadarshemesh.thrivecart.com/new-sound-core-3p/',                    '175'),
  ('new sound', 'new sound', 'New Sound Standard Fall 2023 (3 Payments x $97)',            'installments', 3,  97,   'https://hadarshemesh.thrivecart.com/ns-3px97-s/',                           '206'),
  ('new sound', 'new sound', 'New Sound Standard Spring 2024 (6 Payments)',                'installments', 6,  147,  'https://hadarshemesh.thrivecart.com/new-sound-6p/',                         '213'),
  ('new sound', 'new sound', 'New Sound Standard (12 Payments) 2025',                     'installments', 12, 65,   'https://hadarshemesh.thrivecart.com/new-sound-12p/',                        '219'),
  ('new sound', 'new sound', 'New Sound Core 2025 (3 payments)',                           'installments', 3,  149,  'https://hadarshemesh.thrivecart.com/new-sound-core-2025-3p/',              '274'),
  ('new sound', 'new sound', 'New Sound CamVision (3 payments)',                           'installments', 3,  0,    'https://hadarshemesh.thrivecart.com/new-sound-camvision-3p/',              '279'),
  ('new sound', 'new sound', 'New Sound (NS11 evergreen 3p discounted)',                   'installments', 3,  247,  'https://hadarshemesh.thrivecart.com/ns-live-3p/',                           '292'),
  ('new sound', 'new sound', 'New Sound (NS11 evergreen 3p full price)',                   'installments', 3,  247,  'https://hadarshemesh.thrivecart.com/ns-live-3p-f/',                         '295'),
  ('new sound', 'new sound', 'New Sound (NS11 Evergreen 6p discounted)',                   'installments', 6,  247,  'https://hadarshemesh.thrivecart.com/ns-live-6p/',                           '300'),
  ('new sound', 'new sound', 'New Sound Standard 2025',                                    'subscription', NULL,600, 'https://hadarshemesh.thrivecart.com/new-sound-standard/',                  '41'),
  ('new sound', 'new sound', 'New Sound Core 2025',                                        'one-payment',  1,  447,  'https://hadarshemesh.thrivecart.com/new-sound-core/',                       '174'),
  ('new sound', 'new sound', '1:1 Fluency Session x 1 - $60',                              'one-payment',  1,  60,   'https://hadarshemesh.thrivecart.com/11-fluency-session-x1-60/',             '236'),
  ('new sound', 'new sound', 'New Sound CamVision',                                        'one-payment',  NULL,NULL,'https://hadarshemesh.thrivecart.com/new-sound-camvision/',                 '278'),
  ('new sound', 'new sound', '1:1 Pronunciation Sessions x 5 ($400)',                      'one-payment',  NULL,400, 'https://hadarshemesh.thrivecart.com/11-pronunciation-sessions-x-5-400/',   '282'),
  ('new sound', 'new sound', 'New Sound (NS11 evergreen 1p discounted)',                   'one-payment',  NULL,247, 'https://hadarshemesh.thrivecart.com/ns-live-1p/',                           '290'),
  ('new sound', 'new sound', 'New Sound (NS11 evergreen 1p full price)',                   'one-payment',  1,  247,  'https://hadarshemesh.thrivecart.com/ns-live-1p-f/',                         '296'),
  ('new sound', 'new sound', 'New Sound (NS11 Beyonders 1p discounted)',                   'one-payment',  NULL,247, 'https://hadarshemesh.thrivecart.com/by-ns-live-1p/',                        '299'),
  ('new sound', 'new sound', 'New Sound Premium Coaching (1p/4p)',                         'one-payment',  NULL,200, 'https://hadarshemesh.thrivecart.com/ns-live-pod-upgrade/',                  '301'),
  -- new sound feedback
  ('new sound', 'new sound feedback', 'New Sound Feedback Fall 2023 (6 Payments)',         'installments', 6,  197,  'https://hadarshemesh.thrivecart.com/new-sound-feedback-6p/',                '167'),
  ('new sound', 'new sound feedback', 'New Sound Feedback (2 Payments)',                   'installments', 2,  200,  'https://hadarshemesh.thrivecart.com/new-sound-feedback-2p/',                '171'),
  ('new sound', 'new sound feedback', 'New Sound Feedback',                                'subscription', 1,  400,  'https://hadarshemesh.thrivecart.com/new-sound-feedback-1p/',                '92'),
  ('new sound', 'new sound feedback', 'New Sound Feedback Fall 2023',                      'one-payment',  1,  1097, 'https://hadarshemesh.thrivecart.com/new-sound-feedback-1p-2023/',           '166'),
  -- new sound feedback LE
  ('new sound', 'new sound feedback LE', 'New Sound LE Feedback Fall 2023 (2 Payments)',   'installments', 2,  299,  'https://hadarshemesh.thrivecart.com/new-sound-le-feedback-2p/',             '170'),
  ('new sound', 'new sound feedback LE', 'New Sound LE Feedback Fall 2023',                'one-payment',  1,  597,  'https://hadarshemesh.thrivecart.com/new-sound-le-feedback-1p/',             '169'),
  -- new sound LE
  ('new sound', 'new sound LE', 'New Sound LE Standard (3 Payments) 2025',                'installments', 3,  77,   'https://hadarshemesh.thrivecart.com/new-sound-le-3p/',                      '77'),
  ('new sound', 'new sound LE', 'New Sound LE Standard 2025',                             'subscription', 1,  132,  'https://hadarshemesh.thrivecart.com/new-sound-le-1p/',                      '72'),
  -- new sound POD
  ('new sound', 'new sound POD', 'New Sound - Mini Pods - Upgrade [id83]',                'subscription', 1,  297,  'https://hadarshemesh.thrivecart.com/ns-minipods-1p/',                       '83'),
  ('new sound', 'new sound POD', 'New Sound POD Upgrade',                                 'one-payment',  1,  900,  'https://hadarshemesh.thrivecart.com/new-sound-pod-upgrade-1p/',             '214'),
  ('new sound', 'new sound POD', 'New Sound Coaching Pods',                               'one-payment',  NULL,0,   'https://hadarshemesh.thrivecart.com/new-sound-pods-4p-s/',                  '275'),
  -- new sound VIP
  ('new sound', 'new sound VIP', 'New Sound VIP (6 Payments) 2025',                       'installments', 6,  297,  'https://hadarshemesh.thrivecart.com/new-sound-vip-6p/',                     '150'),
  ('new sound', 'new sound VIP', 'New Sound VIP Spring 2024 (8 Payments)',                'installments', 8,  223,  'https://hadarshemesh.thrivecart.com/new-sound-vip-8p/',                     '221'),
  ('new sound', 'new sound VIP', 'New Sound VIP 2025',                                    'one-payment',  1,  1697, 'https://hadarshemesh.thrivecart.com/new-sound-vip-1p/',                     '131'),
  -- new sound VIP LE
  ('new sound', 'new sound VIP LE', 'New Sound LE VIP (6 Payments)',                      'installments', 6,  0,    'https://hadarshemesh.thrivecart.com/new-sound-le-vip-6p/',                  '78'),
  ('new sound', 'new sound VIP LE', 'New Sound LE VIP 2025',                              'subscription', 1,  0,    'https://hadarshemesh.thrivecart.com/new-sound-le-vip-1p/',                  '75'),
  -- Sprint
  ('Sprint', 'Sprint', 'Sprint Master - $97 [id40]',                                       'subscription', NULL,97,  'https://hadarshemesh.thrivecart.com/sprint-master-join/',                  '40'),
  ('Sprint', 'Sprint', 'Sprint Master - $87 [id182]',                                      'one-payment',  1,  87,   'https://hadarshemesh.thrivecart.com/sprint-master-10/',                    '182'),
  ('Sprint', 'Sprint', 'Sprint Master - $77 [id187]',                                      'one-payment',  1,  77,   'https://hadarshemesh.thrivecart.com/sprint-master-20/',                    '187'),
  ('Sprint', 'Sprint', 'Sprint Master (SM2.0 bump)',                                       'one-payment',  1,  0,    'https://hadarshemesh.thrivecart.com/sprint-checkout/',                     '204'),
  ('Sprint', 'Sprint', 'Sprint Master + Sprint Master 2.0',                                'one-payment',  1,  97,   'https://hadarshemesh.thrivecart.com/sprint-master-by-annual/',             '205'),
  ('Sprint', 'Sprint', '[Black Friday] Grammar Master + Sprint Master 2.0',                'one-payment',  NULL,97,  'https://hadarshemesh.thrivecart.com/grammar-master-black-friday/',         '283'),
  ('Sprint', 'Sprint', '[Black Friday] Sprint Master + Sprint Master 2.0',                 'one-payment',  NULL,0,   'https://hadarshemesh.thrivecart.com/sprint-master-black-friday/',          '284')
) AS v(program_name, product_name, plan_name, payment_type, installments_count, amount, payment_link_url, external_id)
JOIN programs pg ON pg.name = v.program_name
JOIN products pr ON pr.program_id = pg.id AND pr.name = v.product_name
WHERE NOT EXISTS (
  SELECT 1 FROM plans pl WHERE pl.external_id = v.external_id
);

-- ────────────────────────────────────────────────────────────────
-- 4. PRODUCT_PLANS
-- ────────────────────────────────────────────────────────────────
INSERT INTO product_plans (
  id, product_id, plan_name, plan_code,
  price, currency, installments,
  collection_gateway, collection_gateway_product_id, collection_gateway_link,
  active
)
SELECT
  gen_random_uuid(),
  pr.id,
  v.plan_name,
  v.plan_code,
  COALESCE(v.amount, 0),
  'USD',
  COALESCE(v.installments_count, 1),
  'thrivecart',
  v.external_id,
  v.payment_link_url,
  true
FROM (VALUES
  -- Beyond
  ('Beyond', 'Beyond', 'Beyond (6 months Payment) [id240]',                  'beyond-6m 2025 [without sidebar]',             6,  186,   'https://hadarshemesh.thrivecart.com/beyond-6m/',                               '240'),
  ('Beyond', 'Beyond', 'Beyond (6 months Payment) [id246]',                  'beyond-6m 2025 [without sidebar]',             6,  186,   'https://hadarshemesh.thrivecart.com/beyond-6-months/',                         '246'),
  ('Beyond', 'Beyond', 'Beyond Monthly Membership',                          'beyond-m $39 2026',                            1,  37,    'https://hadarshemesh.thrivecart.com/beyond-m',                                 '1'),
  ('Beyond', 'Beyond', 'Beyond - Annual x $290 [id2]',                       'beyond-y',                                     1,  290,   'https://hadarshemesh.thrivecart.com/beyond-y/',                                '2'),
  ('Beyond', 'Beyond', 'Beyond (Monthly Payment) [id234]',                   'beyond monthly $37 w/out sidebar (Sep 2024)',  1,  7,     'https://hadarshemesh.thrivecart.com/beyond-mo/',                               '234'),
  ('Beyond', 'Beyond', 'Beyond - monthly subscription [id239]',              'beyond monthly $37 with sidebar (Sep 2024)',   1,  37,    'https://hadarshemesh.thrivecart.com/beyond-monthly/',                          '239'),
  ('Beyond', 'Beyond', 'Beyond – Semi-Annual Membership',                    'beyond-6mo $189 2026',                         1,  189,   'https://hadarshemesh.thrivecart.com/beyond-6mo/',                              '254'),
  ('Beyond', 'Beyond', 'Beyond - Monthly x $37 [p-id255]',                   'beyond-m $37 discount $7',                     1,  NULL,  'https://hadarshemesh.thrivecart.com/beyond-m-p-id255/',                        '255'),
  ('Beyond', 'Beyond', 'Beyond Membership (1st month FREE)',                  'ns-beyond-m $37 2025 30-day trial',            1,  0,     'https://hadarshemesh.thrivecart.com/ns-beyond-m/',                             '263'),
  ('Beyond', 'Beyond', 'Beyond [Semi-Annual Membership]',                    'ns-beyond-6m 2025 30-day trial',               1,  185,   'https://hadarshemesh.thrivecart.com/ns-beyond-6m/',                            '264'),
  ('Beyond', 'Beyond', 'Beyond Monthly Membership (legacy)',                 'beyond-m $29',                                 1,  29,    'https://hadarshemesh.thrivecart.com/beyond-m-legacy/',                         '268'),
  ('Beyond', 'Beyond', 'Beyond – Annual Membership',                         'beyond-annual $299 2026',                      1,  299,   'https://hadarshemesh.thrivecart.com/beyond-annual/',                           '285'),
  ('Beyond', 'Beyond', 'Beyond Lite Monthly Membership',                     'beyond lite monthly $19 2026',                 1,  0.19,  'https://hadarshemesh.thrivecart.com/go-beyond-lite/',                          '291'),
  ('Beyond', 'Beyond', 'Beyond – Annual Membership (upgraded)',               'upgraded from $7/mo to BY annual $299 Mar26', 1,  299,   'https://hadarshemesh.thrivecart.com/beyond-annual-upgraded/',                  '293'),
  -- chat
  ('chat',   'chat',   'ChatGPT English Practice Guide',                     'ChatGPT English Practice Guide',               1,  21,    'https://hadarshemesh.thrivecart.com/chat/',                                    '223'),
  -- Coaching
  ('Coaching', 'Coaching', '1:1 Pronunciation Sessions x 1 - $90 [id31]',   'one coaching session for $90',                 1,  90,    'https://hadarshemesh.thrivecart.com/coaching-session-2021/',                   '31'),
  ('Coaching', 'Coaching', '1:1 Pronunciation Sessions x 1 - $95 [id33]',   '1:1 coach session for general $95',            1,  95,    'https://hadarshemesh.thrivecart.com/coaching-session/',                        '33'),
  ('Coaching', 'Coaching', 'Fluency Session 1:1 - 5 Sessions - $250 [id100]','Fluency Session 1:1 $250',                    1,  250,   'https://hadarshemesh.thrivecart.com/fluency-session-11x5-250/',                '100'),
  ('Coaching', 'Coaching', '1:1 Fluency Session x 1 - $50 [id130]',         '1:1 Fluency session x1 $50',                   1,  50,    'https://hadarshemesh.thrivecart.com/11-fluency-session-x1-50/',                '130'),
  ('Coaching', 'Coaching', '1:1 Fluency Session x 1 - $55 [id142]',         '1:1 Fluency session x1 $50',                   1,  55,    'https://hadarshemesh.thrivecart.com/11-fluency-session-x1-55/',                '142'),
  ('Coaching', 'Coaching', 'Fluency Session 1:1 - 5 Sessions',               'Fluency Session 1:1 $300',                    1,  300,   'https://hadarshemesh.thrivecart.com/fluency-session-11x5-300/',                '195'),
  ('Coaching', 'Coaching', '1:1 Pronunciation Session x 1',                  '1:1 coach session for general $115',          1,  115,   'https://hadarshemesh.thrivecart.com/11-pronunciation-1-session/',              '196'),
  ('Coaching', 'Coaching', '1:1 Pronunciation Session x 1 [id237]',          '1:1 coach session for general',               1,  104,   'https://hadarshemesh.thrivecart.com/pronunciation-session/',                   '237'),
  -- Coaching packages
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 4 - $355 [id34]',      '4 coaching sessions $355 (special request)',  4,  355,  'https://hadarshemesh.thrivecart.com/coaching-sessions-4/',                   '34'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 5',                    'Five 1:1 pronunciation sessions 520',         1,  520,  'https://hadarshemesh.thrivecart.com/11-pronunciation-5-sessionsx520/',       '197'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 5 -$450 [id59]',       'Five 1:1 pronunciation sessions 450',         1,  NULL, 'https://hadarshemesh.thrivecart.com/11-pronunciation-5-sessions/',          '59'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 5 -$450 [id163]',      'Five 1:1 pronunciation sessions 450',         5,  90,   'https://hadarshemesh.thrivecart.com/11-pronunciation-5-sessions-90x5/',      '163'),
  ('Coaching', 'Coaching - packages', 'Speaking with Feedback 1:1 - 5 sessions',            'Speaking with Feedback 1:1 - 5 sessions',    1,  225,  'https://hadarshemesh.thrivecart.com/swf11/',                                 '247'),
  ('Coaching', 'Coaching - packages', '30 minute classes x 5',                              'Five 30 minute classes $210',                1,  210,  'https://hadarshemesh.thrivecart.com/30-minute-classes-x-5-210/',             '267'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 10 - $850 [id57]',     '10 sessions for $850',                       1,  850,  'https://hadarshemesh.thrivecart.com/pronunciation-coaching-10s/',            '57'),
  ('Coaching', 'Coaching - packages', '1:1 Fluency Session x 10 - $550',                   '1:1 Fluency session x10 $55',                1,  0,    'https://hadarshemesh.thrivecart.com/11-fluency-session-x10-55/',             '241'),
  ('Coaching', 'Coaching - packages', '1:1 Fluency Session x 10 Classes',                  '1:1 Fluency session x10 $420',               1,  210,  'https://hadarshemesh.thrivecart.com/11-fluency-session-x10-420/',            '248'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 10 -$960 [id250]',     'Ten 1:1 pronunciation sessions 960',         1,  960,  'https://hadarshemesh.thrivecart.com/11-pronunciation-sessions-x-10-960-id250/', '250'),
  ('Coaching', 'Coaching - packages', 'Speaking with Feedback 1:1 - 10 sessions',           'Speaking with Feedback 1:1 - 10 sessions',   1,  450,  'https://hadarshemesh.thrivecart.com/speaking-with-feedback-10-sessions/',    '266'),
  ('Coaching', 'Coaching - packages', '1:1 Pronunciation Sessions x 12',                   'pronunciation-coaching-12',                   1,  1020, 'https://hadarshemesh.thrivecart.com/pronunciation-coaching-12s/',            '245'),
  -- Fluency Festival VIP
  ('Fluency Festival VIP', 'Fluency Festival VIP', 'Fluency Festival VIP',                 'ns10 fluency festival vip',                   1,  0,    'https://hadarshemesh.thrivecart.com/festival-vip/',                          '272'),
  -- Grammar Master
  ('Grammar Master', 'Grammar Master', '4 Group Classes with Marcela',                     'SwF2p',                                        1,  50,   'https://hadarshemesh.thrivecart.com/gswf50/',                                '244'),
  ('Grammar Master', 'Grammar Master', 'Grammar Master',                                   'Grammar Master',                               1,  147,  'https://hadarshemesh.thrivecart.com/grammar-master/',                        '270'),
  -- HPW
  ('HPW', 'HPW', 'Hadar''s Pronunciation Workshop - $397 [id53]',                          'hpw2',                                         1,  397,  'https://hadarshemesh.thrivecart.com/hpw2/',                                 '53'),
  ('HPW', 'HPW', 'Hadar''s Pronunciation Workshop - $397 [id111]',                         'hpw-hm',                                       1,  NULL, 'https://hadarshemesh.thrivecart.com/hpw-hm/',                               '111'),
  -- Mindset
  ('Mindset', 'Mindset', 'My English Mindset',                                             'English Mindset',                              1,  24.5, 'https://hadarshemesh.thrivecart.com/mindset-checkout/',                     '160'),
  ('Mindset', 'Mindset', 'My English Mindset New Year Sale 50% OFF',                       'MEM NY sale for 50% OFF sales page',           1,  49,   'https://hadarshemesh.thrivecart.com/ny-sale-mindset/',                      '249'),
  -- new sound
  ('new sound', 'new sound', 'New Sound Standard (8 Payments) 2025',                       '#ns-8p',                                       8,  97,   'https://hadarshemesh.thrivecart.com/new-sound-8p/',                         '69'),
  ('new sound', 'new sound', 'New Sound Standard Fall 2023 (12 Payments)',                 'ns-fall-12p',                                  12, 65,   'https://hadarshemesh.thrivecart.com/new-sound-fall-12p/',                   '80'),
  ('new sound', 'new sound', 'New Sound Program - Three Monthly Payments $97',             '97s-3p',                                       3,  97,   'https://hadarshemesh.thrivecart.com/97s-3p/',                               '104'),
  ('new sound', 'new sound', 'New Sound Feedback Fall 2023 (8 Payments)',                  'ns-feedback-8',                                8,  149,  'https://hadarshemesh.thrivecart.com/new-sound-feedback-8p/',                '168'),
  ('new sound', 'new sound', 'New Sound Core (3p) 2025',                                   'ns-core-3p',                                   3,  149,  'https://hadarshemesh.thrivecart.com/new-sound-core-3p/',                    '175'),
  ('new sound', 'new sound', 'New Sound Standard Fall 2023 (3 Payments x $97)',            'ns-3px97-s',                                   3,  97,   'https://hadarshemesh.thrivecart.com/ns-3px97-s/',                           '206'),
  ('new sound', 'new sound', 'New Sound Standard Spring 2024 (6 Payments)',                'ns-6p',                                        6,  147,  'https://hadarshemesh.thrivecart.com/new-sound-6p/',                         '213'),
  ('new sound', 'new sound', 'New Sound Standard (12 Payments) 2025',                     '# ns-12p',                                     12, 65,   'https://hadarshemesh.thrivecart.com/new-sound-12p/',                        '219'),
  ('new sound', 'new sound', 'New Sound Core 2025 (3 payments)',                           '# ns-core-3p',                                 3,  149,  'https://hadarshemesh.thrivecart.com/new-sound-core-2025-3p/',              '274'),
  ('new sound', 'new sound', 'New Sound CamVision (3 payments)',                           '# ns-core-camvision-3p',                       3,  0,    'https://hadarshemesh.thrivecart.com/new-sound-camvision-3p/',              '279'),
  ('new sound', 'new sound', 'New Sound (NS11 evergreen 3p discounted)',                   'NS11 evergreen 3p X $177 DISCOUNTED coupon',   3,  247,  'https://hadarshemesh.thrivecart.com/ns-live-3p/',                           '292'),
  ('new sound', 'new sound', 'New Sound (NS11 evergreen 3p full price)',                   'NS11 evergreen 3p X $247 FULL price',          3,  247,  'https://hadarshemesh.thrivecart.com/ns-live-3p-f/',                         '295'),
  ('new sound', 'new sound', 'New Sound (NS11 Evergreen 6p discounted)',                   'NS11 Evergreen 6p X $92 DISCOUNTED COUPON',    6,  247,  'https://hadarshemesh.thrivecart.com/ns-live-6p/',                           '300'),
  ('new sound', 'new sound', 'New Sound Standard 2025',                                    '# ns-1p',                                      1,  600,  'https://hadarshemesh.thrivecart.com/new-sound-standard/',                  '41'),
  ('new sound', 'new sound', 'New Sound Core 2025',                                        '# ns-core-1p',                                 1,  447,  'https://hadarshemesh.thrivecart.com/new-sound-core/',                       '174'),
  ('new sound', 'new sound', '1:1 Fluency Session x 1 - $60',                              '1:1 Fluency session x1 $60',                   1,  60,   'https://hadarshemesh.thrivecart.com/11-fluency-session-x1-60/',             '236'),
  ('new sound', 'new sound', 'New Sound CamVision',                                        '# ns-core-camvision-1p',                       1,  NULL, 'https://hadarshemesh.thrivecart.com/new-sound-camvision/',                 '278'),
  ('new sound', 'new sound', '1:1 Pronunciation Sessions x 5 ($400)',                      'Five 1:1 pronunciation sessions $400',         1,  400,  'https://hadarshemesh.thrivecart.com/11-pronunciation-sessions-x-5-400/',   '282'),
  ('new sound', 'new sound', 'New Sound (NS11 evergreen 1p discounted)',                   'NS11 evergreen 1p $497 DISCOUNTED from 697',   1,  247,  'https://hadarshemesh.thrivecart.com/ns-live-1p/',                           '290'),
  ('new sound', 'new sound', 'New Sound (NS11 evergreen 1p full price)',                   'NS11 evergreen 1p $697 FULL price',            1,  247,  'https://hadarshemesh.thrivecart.com/ns-live-1p-f/',                         '296'),
  ('new sound', 'new sound', 'New Sound (NS11 Beyonders 1p discounted)',                   'NS11 Beyonders 1p $497 DISCOUNTED from 697',   1,  247,  'https://hadarshemesh.thrivecart.com/by-ns-live-1p/',                        '299'),
  ('new sound', 'new sound', 'New Sound Premium Coaching (1p/4p)',                         'NS11 POD upgrade 1x$800 OR 4x$200 [2 pricing]',1, 200,  'https://hadarshemesh.thrivecart.com/ns-live-pod-upgrade/',                  '301'),
  -- new sound feedback
  ('new sound', 'new sound feedback', 'New Sound Feedback Fall 2023 (6 Payments)',         'ns-feedback-6p',                               6,  197,  'https://hadarshemesh.thrivecart.com/new-sound-feedback-6p/',                '167'),
  ('new sound', 'new sound feedback', 'New Sound Feedback (2 Payments)',                   'ns-feedback-2p',                               2,  200,  'https://hadarshemesh.thrivecart.com/new-sound-feedback-2p/',                '171'),
  ('new sound', 'new sound feedback', 'New Sound Feedback',                                'ns-feedback-1p',                               1,  400,  'https://hadarshemesh.thrivecart.com/new-sound-feedback-1p/',                '92'),
  ('new sound', 'new sound feedback', 'New Sound Feedback Fall 2023',                      'ns-feedback-1p-2023',                          1,  1097, 'https://hadarshemesh.thrivecart.com/new-sound-feedback-1p-2023/',           '166'),
  -- new sound feedback LE
  ('new sound', 'new sound feedback LE', 'New Sound LE Feedback Fall 2023 (2 Payments)',   'ns-experience-feedback-2p',                    2,  299,  'https://hadarshemesh.thrivecart.com/new-sound-le-feedback-2p/',             '170'),
  ('new sound', 'new sound feedback LE', 'New Sound LE Feedback Fall 2023',                'ns-experience-feedback-1p',                    1,  597,  'https://hadarshemesh.thrivecart.com/new-sound-le-feedback-1p/',             '169'),
  -- new sound LE
  ('new sound', 'new sound LE', 'New Sound LE Standard (3 Payments) 2025',                '# new-sound-le-3p',                            3,  77,   'https://hadarshemesh.thrivecart.com/new-sound-le-3p/',                      '77'),
  ('new sound', 'new sound LE', 'New Sound LE Standard 2025',                             '# new-sound-le-1p',                            1,  132,  'https://hadarshemesh.thrivecart.com/new-sound-le-1p/',                      '72'),
  -- new sound POD
  ('new sound', 'new sound POD', 'New Sound - Mini Pods - Upgrade [id83]',                'ns-mini pods-1P',                              1,  297,  'https://hadarshemesh.thrivecart.com/ns-minipods-1p/',                       '83'),
  ('new sound', 'new sound POD', 'New Sound POD Upgrade',                                 'ns-pod-upgrade-1p',                            1,  900,  'https://hadarshemesh.thrivecart.com/new-sound-pod-upgrade-1p/',             '214'),
  ('new sound', 'new sound POD', 'New Sound Coaching Pods',                               '# ns-pods-4p-s',                               1,  0,    'https://hadarshemesh.thrivecart.com/new-sound-pods-4p-s/',                  '275'),
  -- new sound VIP
  ('new sound', 'new sound VIP', 'New Sound VIP (6 Payments) 2025',                       '# ns-vip-6p',                                  6,  297,  'https://hadarshemesh.thrivecart.com/new-sound-vip-6p/',                     '150'),
  ('new sound', 'new sound VIP', 'New Sound VIP Spring 2024 (8 Payments)',                'ns-vip-8p',                                    8,  223,  'https://hadarshemesh.thrivecart.com/new-sound-vip-8p/',                     '221'),
  ('new sound', 'new sound VIP', 'New Sound VIP 2025',                                    '# ns-vip-1p',                                  1,  1697, 'https://hadarshemesh.thrivecart.com/new-sound-vip-1p/',                     '131'),
  -- new sound VIP LE
  ('new sound', 'new sound VIP LE', 'New Sound LE VIP (6 Payments)',                      '# ns-experience-vip-6p',                       6,  0,    'https://hadarshemesh.thrivecart.com/new-sound-le-vip-6p/',                  '78'),
  ('new sound', 'new sound VIP LE', 'New Sound LE VIP 2025',                              '# ns-experience-vip-1p',                       1,  0,    'https://hadarshemesh.thrivecart.com/new-sound-le-vip-1p/',                  '75'),
  -- Sprint
  ('Sprint', 'Sprint', 'Sprint Master - $97 [id40]',                                       'sprint master main offer',                     1,  97,   'https://hadarshemesh.thrivecart.com/sprint-master-join/',                  '40'),
  ('Sprint', 'Sprint', 'Sprint Master - $87 [id182]',                                      'sprintm-10-rookie',                            1,  87,   'https://hadarshemesh.thrivecart.com/sprint-master-10/',                    '182'),
  ('Sprint', 'Sprint', 'Sprint Master - $77 [id187]',                                      'sprintm-20-rookie',                            1,  77,   'https://hadarshemesh.thrivecart.com/sprint-master-20/',                    '187'),
  ('Sprint', 'Sprint', 'Sprint Master (SM2.0 bump)',                                       'SM with SM2.0 Bump offer 2026',                1,  0,    'https://hadarshemesh.thrivecart.com/sprint-checkout/',                     '204'),
  ('Sprint', 'Sprint', 'Sprint Master + Sprint Master 2.0',                                'sprintm-BY-cancel-downsell',                   1,  97,   'https://hadarshemesh.thrivecart.com/sprint-master-by-annual/',             '205'),
  ('Sprint', 'Sprint', '[Black Friday] Grammar Master + Sprint Master 2.0',                'Grammar Master Black Friday 2025',             1,  97,   'https://hadarshemesh.thrivecart.com/grammar-master-black-friday/',         '283'),
  ('Sprint', 'Sprint', '[Black Friday] Sprint Master + Sprint Master 2.0',                 'SM+SM2.0 Black Friday 2025',                   1,  0,    'https://hadarshemesh.thrivecart.com/sprint-master-black-friday/',          '284')
) AS v(program_name, product_name, plan_name, plan_code, installments_count, amount, payment_link_url, external_id)
JOIN programs pg ON pg.name = v.program_name
JOIN products pr ON pr.program_id = pg.id AND pr.name = v.product_name
WHERE NOT EXISTS (
  SELECT 1 FROM product_plans pp WHERE pp.collection_gateway_product_id = v.external_id
);

COMMIT;
