-- migration 013: bulk tag rename RPC
-- Replaces the row-by-row _replaceTagInTableRows JS loop.
-- Run on both demo and production databases.

CREATE OR REPLACE FUNCTION rename_tag(old_tag text, new_tag text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE transactions
  SET tags = array_replace(tags, old_tag, new_tag)
  WHERE old_tag = ANY(tags);

  UPDATE vendors
  SET tags = array_replace(tags, old_tag, new_tag)
  WHERE old_tag = ANY(tags);
$$;

-- Allow anon to call it (RLS is open for demo; production will add RLS later)
GRANT EXECUTE ON FUNCTION rename_tag(text, text) TO anon;
