-- Migration 014: add free-text name column to rates
-- Allows storing a human-readable label per rate (e.g. "Accent's Way Coaching")
-- independent of the session_type enum value.
-- Run on BOTH demo and production.

ALTER TABLE rates ADD COLUMN IF NOT EXISTS name text;
