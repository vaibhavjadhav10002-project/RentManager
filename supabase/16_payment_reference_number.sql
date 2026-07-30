-- ============================================================================
-- PHASE 1: Premium Documents — payment reference number
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- Optional UPI/bank transaction reference the owner can record against a
-- payment, shown on the premium receipt PDF.
alter table payments add column if not exists reference_number text;

-- ============================================================================
-- DONE
-- ============================================================================
