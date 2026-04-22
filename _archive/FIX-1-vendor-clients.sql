-- ════════════════════════════════════════════════════════════════
-- FIX #1: Repair Missing vendor_clients Records
-- ════════════════════════════════════════════════════════════════
-- 
-- WHAT THIS FIXES: Client dropdown showing empty
-- WHY: 23 sessions exist with vendor+client pairs but no junction record
-- RUN IN: Supabase SQL Editor
--
-- ════════════════════════════════════════════════════════════════

INSERT INTO vendor_clients (vendor_id, client_id)
SELECT DISTINCT s.vendor_id, s.client_id
FROM sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_clients vc 
  WHERE vc.vendor_id = s.vendor_id 
  AND vc.client_id = s.client_id
)
AND s.vendor_id IS NOT NULL 
AND s.client_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verify the fix worked:
SELECT 
  'Records inserted' as action,
  COUNT(DISTINCT (s.vendor_id, s.client_id)) as count
FROM sessions s
WHERE EXISTS (
  SELECT 1 FROM vendor_clients vc 
  WHERE vc.vendor_id = s.vendor_id 
  AND vc.client_id = s.client_id
);

-- Expected result: Should show all your session vendor+client combinations now have junction records
