// v2/shared/constants.js — Single source of truth for all shared constants.
// Load before any space module. Do not redefine these anywhere else.

const Const = (() => {
  // ─── Deal / sales ────────────────────────────────────────────────
  const DEAL_STAGES = ['lead', 'qualified', 'active', 'delivered', 'closed']
  const DEAL_STAGE_LABELS = {
    lead: 'Lead', qualified: 'Qualified', active: 'Active',
    delivered: 'Delivered', closed: 'Closed'
  }

  const BILLING_STATUS = ['pending', 'link_sent', 'invoiced', 'partial', 'paid', 'overdue']
  const BILLING_STATUS_LABELS = {
    pending: 'Pending', link_sent: 'Link sent', invoiced: 'Invoiced',
    partial: 'Partial', paid: 'Paid', overdue: 'Overdue'
  }
  const BILLING_STATUS_COLORS = {
    pending: 'amber', link_sent: 'blue', invoiced: 'blue',
    partial: 'amber', paid: 'green', overdue: 'red'
  }

  // ─── Vendors ─────────────────────────────────────────────────────
  const VENDOR_TYPES = ['coach', 'contractor', 'team_member', 'merchant']
  const VENDOR_TYPE_LABELS = {
    coach: 'Coach', contractor: 'Contractor',
    team_member: 'Team member', merchant: 'Merchant'
  }
  const VENDOR_TYPE_COLORS = {
    coach: 'blue', contractor: 'purple', team_member: 'green', merchant: 'amber'
  }

  const PAYMENT_CADENCES = ['recurring', 'project_based', 'one_time']
  const PAYMENT_CADENCE_LABELS = {
    recurring: 'Recurring', project_based: 'Project-based', one_time: 'One-time'
  }

  // ─── Plans (canonical: plan_type from SCHEMA.md) ─────────────────
  const PLAN_TYPES = ['One payment', '3 payments', '4 payments', '5 payments', 'Subscription']

  const PAYMENT_PROCESSORS = ['stripe', 'wise', 'thrive', 'other']
  const PAYMENT_PROCESSOR_LABELS = {
    stripe: 'Stripe', wise: 'Wise', thrive: 'ThriveCart', other: 'Other'
  }

  // ─── Gateways (plan link_source values) ──────────────────────────
  const GATEWAY_LABELS = {
    ThriveCart: 'ThriveCart',
    'Green Invoice': 'Green Invoice',
    Stripe: 'Stripe',
    PayPal: 'PayPal',
    'Manual URL': 'Manual URL'
  }

  // ─── Deal meta ───────────────────────────────────────────────────
  const ORIGINS = ['manual', 'thrivecart', 'green_invoice', 'other']
  const VAT_MODES = ['excl', 'incl']

  // ─── Sessions ────────────────────────────────────────────────────
  const SESSION_STATUSES = ['planned', 'done', 'cancelled', 'no_show']

  // ─── Bills ───────────────────────────────────────────────────────
  const BILL_STATUSES = ['draft', 'submitted', 'approved', 'paid', 'returned']
  const BILL_STATUS_LABELS = {
    draft: 'Draft', submitted: 'Submitted', approved: 'Approved',
    paid: 'Paid', returned: 'Returned'
  }

  // ─── Transactions ────────────────────────────────────────────────
  const TX_DIRECTIONS = ['in', 'out']
  const TX_STATUSES = ['unmatched', 'matched', 'reconciled', 'deleted']

  const TAX_TREATMENTS = [
    'non_deductible',
    'mixed_review',
    'income',
    'business_payroll_contractors',
    'business_professional_services',
    'business_banking_fees',
    'business_taxes_government',
    'business_insurance',
    'business_software_online',
    'business_travel',
    'business_equipment',
    'business_marketing',
    'business_training'
  ]
  const TAX_TREATMENT_LABELS = {
    non_deductible: 'Non-deductible',
    mixed_review: 'Mixed / review',
    income: 'Income',
    business_payroll_contractors: 'Payroll & contractors',
    business_professional_services: 'Professional services',
    business_banking_fees: 'Banking fees',
    business_taxes_government: 'Taxes & government',
    business_insurance: 'Insurance',
    business_software_online: 'Software & online',
    business_travel: 'Travel',
    business_equipment: 'Equipment',
    business_marketing: 'Marketing',
    business_training: 'Training'
  }

  const ENTITY_VALUES = ['business', 'private']

  // Currencies we render directly (symbol-aware). Other codes render as "<CCY> N.NN".
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS']

  // ─── Activities ──────────────────────────────────────────────────
  const ACTIVITY_TYPES = ['note', 'reminder', 'system_log', 'integration_event']
  const ACTIVITY_STATUSES = ['pending', 'done', 'dismissed']

  // ─── Roles ───────────────────────────────────────────────────────
  const ROLES = ['admin', 'manager', 'vendor']

  return {
    DEAL_STAGES, DEAL_STAGE_LABELS,
    BILLING_STATUS, BILLING_STATUS_LABELS, BILLING_STATUS_COLORS,
    VENDOR_TYPES, VENDOR_TYPE_LABELS, VENDOR_TYPE_COLORS,
    PAYMENT_CADENCES, PAYMENT_CADENCE_LABELS,
    PLAN_TYPES,
    PAYMENT_PROCESSORS, PAYMENT_PROCESSOR_LABELS,
    GATEWAY_LABELS,
    ORIGINS, VAT_MODES,
    SESSION_STATUSES,
    BILL_STATUSES, BILL_STATUS_LABELS,
    TX_DIRECTIONS, TX_STATUSES,
    TAX_TREATMENTS, TAX_TREATMENT_LABELS,
    ENTITY_VALUES,
    CURRENCIES,
    ACTIVITY_TYPES, ACTIVITY_STATUSES,
    ROLES
  }
})()

window.Const = Const
