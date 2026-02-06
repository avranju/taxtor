# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Indian Advance Tax Calculator — a React + TypeScript web app that helps Indian taxpayers calculate advance tax liability, penalties, and interest for FY 2025-26 (AY 2026-27). This is a greenfield project; the full requirements specification lives in `docs/req.md`.

## Technical Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context API or Zustand
- **Form Handling**: React Hook Form + Zod validation
- **Date Handling**: date-fns
- **UI Components**: Headless UI or Radix UI

## Expected Commands

Once scaffolded with Vite:

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Lint (ESLint)
npm run test       # Run tests (Vitest expected)
```

## Architecture

### Multi-Step Wizard (7 steps)

1. **Personal Information** — taxpayer category, residential status, age bracket
2. **Salary Income** — gross salary, professional tax, standard deduction, TDS
3. **MF Withdrawals** — multiple mutual fund redemption entries (debt/equity), per-entry capital gains with LTCG/STCG classification
4. **US Stock Income** — sale proceeds in USD/INR, cost basis, holding period, capital gains
5. **Other Income** — interest, rental, misc income with TDS
6. **Deductions** — 80C, 80D, 80CCD(1B), 80G, 24(b), Chapter VI-A
7. **Advance Tax Payments** — quarterly payments made (June/Sept/Dec/March)

### Calculation Engine

Core functions that must be implemented:

- `calculateCapitalGains()` — MF withdrawal gains per entry (debt: LTCG if >36 months, equity: LTCG if >12 months) and US stock gains (LTCG if >24 months at 20% with indexation, else STCG at 15%)
- `calculateTaxLiability(regime: 'old' | 'new')` — apply slab rates, cess (4%), surcharge, rebate u/s 87A
- `calculateAdvanceTaxSchedule()` — required vs actual installments
- `calculateInterest234B()` — 1% per month simple interest on shortfall (advance tax < 90% of assessed tax)
- `calculateInterest234C()` — 1% per month simple interest on deferred installments
- `generateWorksheet()` — produce the final tax computation output

### State Shape

```typescript
interface TaxState {
  personalInfo: PersonalInfo;
  salaryIncome: SalaryIncome | null;
  mfWithdrawals: MutualFundWithdrawal[];
  usStockIncome: USStockIncome | null;
  otherIncome: OtherIncome[];
  deductions: Deductions;
  advanceTaxPaid: AdvanceTaxPayment[];
  calculationResults: TaxCalculationResults | null;
}
```

### Tax Regime Slabs

**Old Regime**: 0% up to 2.5L / 5% to 5L / 20% to 10L / 30% above 10L (rebate if income <= 5L)

**New Regime (FY 2025-26)**: 0% up to 3L / 5% to 7L / 10% to 10L / 15% to 12L / 20% to 15L / 30% above 15L (rebate if income <= 7L)

### Data Persistence

- Auto-save form state to localStorage after each step
- Export/import JSON for backup
- Clear data with confirmation

### Output

Final worksheet with 7 sections: Income Summary, Tax Computation (both regimes compared), Advance Tax Schedule, Interest 234B, Interest 234C, TDS Credit, Net Amount Payable. Must support print-friendly CSS and PDF export.
