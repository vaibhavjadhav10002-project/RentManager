-- ============================================================================
-- PHASE 3.5: Deposit Settlement + Deposit Refund Workflow
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- Deposit settlement (deposit_refunded, deposit_refund_date,
-- deposit_deduction_notes) already existed on `tenants` from Phase 2 —
-- this phase only adds structured, itemized deductions alongside the
-- existing free-text notes field (kept for backward compatibility).
alter table tenants add column if not exists deposit_deduction_items jsonb not null default '[]'::jsonb;
-- Shape: [{ "label": "Wall damage", "amount": 500 }, ...]

-- ============================================================================
-- DONE
-- ============================================================================
