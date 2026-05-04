-- schema/user_management_rpc.sql
-- Admin-only RPCs that back admin/users.html.
--
-- Run on BOTH demo (pqkzffgpkpovternesmt) and production (wmqmonjnmgtoilxfqqkv)
-- via the Supabase SQL editor. Status: NOT YET APPLIED.
--
-- Why SECURITY DEFINER:
--   The page reads auth.users.last_sign_in_at (to show "active session"
--   status) and joins it against public.profiles + public.vendors.
--   The anon Supabase client cannot read auth.users directly under standard
--   RLS, so we expose the join through a definer function that gates access
--   server-side: only callers whose own profiles.system_role = 'admin' get
--   rows back. Same idea for update_profile_role.

-- ─── get_user_management_rows() ─────────────────────────────────────────────
-- Returns one row per profile, joined with auth.users.last_sign_in_at and
-- the vendor name (nullable). Admin-only.
CREATE OR REPLACE FUNCTION public.get_user_management_rows()
RETURNS TABLE (
  id                  uuid,
  email               text,
  full_name           text,
  system_role         public.system_role,
  vendor_id           uuid,
  vendor_name         text,
  last_sign_in_at     timestamptz,
  created_at          timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.system_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.system_role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin'::public.system_role THEN
    RAISE EXCEPTION 'forbidden_admin_only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.system_role,
    p.vendor_id,
    v.name AS vendor_name,
    u.last_sign_in_at,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.vendors v ON v.id = p.vendor_id
  ORDER BY p.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_management_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_management_rows() TO authenticated;

-- ─── update_profile_role(target_user_id, new_role) ──────────────────────────
-- Flips the system_role on a single profiles row. Admin-only.
-- Returns the updated row. Refuses to let an admin demote themselves
-- (prevents accidental lockout).
CREATE OR REPLACE FUNCTION public.update_profile_role(
  target_user_id uuid,
  new_role       public.system_role
)
RETURNS TABLE (
  id          uuid,
  system_role public.system_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.system_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.system_role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin'::public.system_role THEN
    RAISE EXCEPTION 'forbidden_admin_only';
  END IF;

  IF target_user_id = auth.uid() AND new_role IS DISTINCT FROM 'admin'::public.system_role THEN
    RAISE EXCEPTION 'cannot_demote_self';
  END IF;

  RETURN QUERY
  UPDATE public.profiles p
  SET system_role = new_role,
      updated_at  = now()
  WHERE p.id = target_user_id
  RETURNING p.id, p.system_role;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_role(uuid, public.system_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_role(uuid, public.system_role) TO authenticated;

NOTIFY pgrst, 'reload schema';
