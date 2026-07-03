-- ============================================================================
-- FIX: Deposit refund/adjustment was never tracked anywhere — tenants table
-- only had deposit_amount and deposit_paid, with no way to record how much
-- (if any) was refunded when a tenant moved out, or deductions made.
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

alter table tenants add column if not exists deposit_refunded numeric(10,2) not null default 0;
alter table tenants add column if not exists deposit_refund_date date;
alter table tenants add column if not exists deposit_deduction_notes text;

-- ============================================================================
-- DONE
-- ============================================================================
