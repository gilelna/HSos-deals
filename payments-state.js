// payments-state.js — Constants, state, and helpers
// Depends on: db.js (window._sb), app.js

// ═══════════════════════════════════════════════════════════════
// CLASSIFICATION CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CATEGORIES = [
  { id: 'ca_income', name: 'Income', tax: 'income' },
  { id: 'ca_internaltransfer', name: 'Internal Transfer', tax: null },
  { id: 'ca_intercompanytransfer', name: 'Intercompany Transfer', tax: null },
  { id: 'ca_ownerdraw', name: 'Owner Draw', tax: 'non_deductible' },
  { id: 'ca_ownersalary', name: 'Owner Salary', tax: 'business_payroll_contractors' },
  { id: 'ca_teammemberspayroll', name: 'Team Members (Payroll)', tax: 'business_payroll_contractors' },
  { id: 'ca_contractorsfreelancers', name: 'Contractors & Freelancers', tax: 'business_professional_services' },
  { id: 'ca_accountingbookkeeping', name: 'Accounting & Bookkeeping', tax: 'business_professional_services' },
  { id: 'ca_bankfees', name: 'Bank Fees', tax: 'business_banking_fees' },
  { id: 'ca_paymentprocessingfees', name: 'Payment Processing Fees', tax: 'business_banking_fees' },
  { id: 'ca_taxesincometaxvatetc', name: 'Taxes (Income Tax, VAT, etc.)', tax: 'business_taxes_government' },
  { id: 'ca_governmentmunicipalutilities', name: 'Government & Municipal', tax: 'business_taxes_government' },
  { id: 'ca_insurance', name: 'Insurance', tax: 'business_insurance' },
  { id: 'ca_softwaresaasrecurring', name: 'Software & SaaS (Recurring)', tax: 'business_software_online' },
  { id: 'ca_softwareonetime', name: 'Software (One-Time)', tax: 'business_software_online' },
  { id: 'ca_serversinfrastructure', name: 'Servers & Infrastructure', tax: 'business_software_online' },
  { id: 'ca_flights', name: 'Flights', tax: 'business_travel' },
  { id: 'ca_travelexpenses', name: 'Travel Expenses', tax: 'business_travel' },
  { id: 'ca_groceries', name: 'Groceries', tax: 'non_deductible' },
  { id: 'ca_restaurantscafes', name: 'Restaurants & Cafes', tax: 'mixed_review' },
  { id: 'ca_shoppingretail', name: 'Shopping & Retail', tax: 'mixed_review' },
  { id: 'ca_electronicsequipment', name: 'Electronics & Equipment', tax: 'business_equipment' },
  { id: 'ca_homehousehold', name: 'Home & Household', tax: 'non_deductible' },
  { id: 'ca_lifestyleleisure', name: 'Lifestyle & Leisure', tax: 'non_deductible' },
  { id: 'ca_cultureentertainment', name: 'Culture & Entertainment', tax: 'mixed_review' },
  { id: 'ca_trainingeducation', name: 'Training & Education', tax: 'business_training' },
  { id: 'ca_medicalhealth', name: 'Medical & Health', tax: 'non_deductible' },
  { id: 'ca_advertisingmarketing', name: 'Advertising & Marketing', tax: 'business_marketing' },
]
