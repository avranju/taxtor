# Indian Advance Tax Calculator - Requirements Specification

## Project Overview

Build a React + TypeScript web application that helps Indian taxpayers calculate their advance tax liability, including penalties and interest for delayed/missed payments, specifically for FY 2025-26 (AY 2026-27).

## Technical Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context API or Zustand
- **Form Handling**: React Hook Form with Zod validation
- **Date Handling**: date-fns
- **UI Components**: Headless UI or Radix UI for accessible components

## Core Functionality

### 1. Wizard Flow Structure

Create a multi-step wizard with the following stages:

#### Step 1: Personal Information

- Financial year confirmation (default: FY 2025-26)
- Taxpayer category:
  - Individual (below 60 years)
  - Senior Citizen (60-80 years)
  - Super Senior Citizen (above 80 years)
- Residential status: Resident/Non-Resident/RNOR
- Business/professional income indicator (Yes/No) for advance-tax senior-citizen exemption check
- Date of unemployment (if applicable during the year)

#### Step 2: Income from Salary (if applicable)

- Employment period during FY 2025-26
- Gross salary received
- Professional tax paid
- Standard deduction (auto-calculate ₹50,000 or pro-rata)
- TDS deducted from salary

#### Step 3: Mutual Fund Withdrawals

Multiple entries supported (add/remove dynamically). Each entry captures:

- Fund name (optional, e.g. "HDFC Balanced Advantage")
- Fund type: equity-oriented or debt-oriented
- Date of investment
- Date of withdrawal (optional; defaults to FY start for holding period calculation)
- Amount withdrawn (₹)
- Cost of acquisition (₹)
- TDS deducted (if any)
- Holding period and LTCG/STCG classification (auto-calculated, read-only)

Skip mode: checkbox "I had mutual fund withdrawals during FY 2025-26". When unchecked, stores empty list and advances.

#### Step 4: Income from Sale of US Stocks

Multiple entries supported (add/remove dynamically). Each entry captures:

- Stock name (optional, e.g. "AAPL, GOOGL")
- Date of purchase
- Date of sale (within FY 2025-26)
- Sale proceeds in USD
- Sale proceeds in INR
- Cost of acquisition in USD
- Cost of acquisition in INR
- Brokerage and transaction charges (₹)
- Holding period and LTCG/STCG classification (auto-calculated, read-only; threshold: >24 months)
- TDS deducted (if any)

Skip mode: checkbox "I had US stock sales during FY 2025-26". When unchecked, stores empty list and advances.

#### Step 5: Other Income Sources

- Interest from savings account
- Interest from fixed deposits
- Rental income
- Any other income
- TDS deducted on each source

#### Step 6: Deductions & Exemptions

- Section 80C investments (PPF, ELSS, LIC, etc.) - Max ₹1.5 lakh
- Section 80D (Health insurance) - based on age category
- Section 80CCD(1B) (NPS) - Max ₹50,000
- Section 80G (Donations)
- Section 24(b) (Home loan interest)
- Other deductions under Chapter VI-A

#### Step 7: Advance Tax Payments Made

- Payment made by June 15, 2025 (15% of tax due for advance tax)
- Payment made by September 15, 2025 (45% cumulative)
- Payment made by December 15, 2025 (75% cumulative)
- Payment made by March 15, 2026 (100%)
- Challan details for each payment

## Calculation Engine

### Tax Calculation Logic

1. **Compute Gross Total Income**
   - Salary income (after standard deduction)
   - Capital gains from mutual fund withdrawals (per entry):
     - If debt fund held >36 months: Long-term capital gain (20% with indexation)
     - If debt fund held ≤36 months: Short-term capital gain (add to income, tax at slab rates)
     - If equity fund held >12 months: Long-term capital gain
     - If equity fund held ≤12 months: Short-term capital gain
   - Capital gains from US stocks:
     - If held >24 months: Long-term capital gain (20% with indexation using CII)
     - If held ≤24 months: Short-term capital gain (15% flat)
   - Other income sources

2. **Apply Deductions**
   - Subtract Chapter VI-A deductions from Gross Total Income
   - Calculate Total Taxable Income

3. **Compute Tax Liability**
   - Apply tax slabs based on regime chosen:
     - **Old Regime** (with deductions):
       - Up to ₹2.5L: Nil
       - ₹2.5L - ₹5L: 5%
       - ₹5L - ₹10L: 20%
       - Above ₹10L: 30%
       - Rebate u/s 87A if income ≤ ₹5L
     - **New Regime** (FY 2025-26 rates):
       - Up to ₹3L: Nil
       - ₹3L - ₹7L: 5%
       - ₹7L - ₹10L: 10%
       - ₹10L - ₹12L: 15%
       - ₹12L - ₹15L: 20%
       - Above ₹15L: 30%
       - Rebate u/s 87A if income ≤ ₹7L
   - Add 4% Health & Education Cess on total tax
   - Add surcharge if applicable (income > ₹50L)

4. **Calculate Advance Tax Liability**
   - Compute `Tax Due for Advance Tax` as:
     - Total tax liability (including surcharge and cess)
     - minus TDS/TCS and eligible relief credits entered in the app
   - If `Tax Due for Advance Tax` > ₹10,000, advance tax is mandatory
   - Exemption: Resident senior/super-senior citizens with no business or professional income are not liable to pay advance tax
   - Required installments:
     - By June 15: 15% of `Tax Due for Advance Tax`
     - By Sept 15: 45% of `Tax Due for Advance Tax` (cumulative)
     - By Dec 15: 75% of `Tax Due for Advance Tax` (cumulative)
     - By March 15: 100% of `Tax Due for Advance Tax`

5. **Calculate Interest u/s 234B** (for shortfall in advance tax)
   - Only if taxpayer was liable for advance tax
   - Compute `Assessed Tax` as total tax liability (including surcharge and cess) minus TDS/TCS and eligible relief credits entered in the app
   - If advance tax paid < 90% of assessed tax
   - Interest: 1% per month (simple interest)
   - Interest amount for estimation: 1% x number of months x (assessed tax - advance tax paid)
   - Period for worksheet estimate: April 1, 2026 to July 31, 2026 (4 months)

6. **Calculate Interest u/s 234C** (for deferment of advance tax installments)
   - Only if taxpayer was liable for advance tax
   For each installment:
   - Compare cumulative advance-tax paid up to due date against required cumulative percentage of `Tax Due for Advance Tax`
   - If payment < required amount, charge interest on shortfall
   - Interest: 1% per month (simple interest)
   - Months: 3 months each for June/September/December installments, 1 month for March installment
   - Calculate separately for each due date and sum the values

### Special Considerations

- **Foreign Asset Reporting**: Flag if US investments exceed reporting thresholds
- **TDS Credit**: Deduct all TDS from final tax payable
- **Self-assessment tax**: Any balance after advance tax and TDS

## User Experience Requirements

### Design Principles

- Clean, minimalist interface
- Single question or related question group per screen
- Progress indicator showing completion percentage
- Ability to navigate back and edit previous answers
- Auto-save to localStorage (recover on browser refresh)
- Inline validation with helpful error messages
- Contextual help tooltips for tax terms

### Wizard Navigation

- "Continue" button (disabled until required fields valid)
- "Back" button on all steps except first
- "Save & Exit" option on every step
- Jump to specific step from progress indicator (only for completed steps)

### Input Enhancements

- Currency formatter for INR (₹) and USD ($)
- Date pickers for transaction dates
- Automatic calculation of holding periods
- Toggle between monthly breakdown and total amounts
- "Skip this section" for inapplicable income sources

## Final Output: Tax Worksheet

### Worksheet Structure

**Section A: Income Summary**

- Table showing all income heads with amounts
- Gross Total Income
- Total Deductions
- Net Taxable Income

**Section B: Tax Computation**

- Comparison table: Old Regime vs New Regime
- Recommended regime (lower tax)
- Tax before cess
- Health & Education Cess (4%)
- Surcharge (if applicable)
- **Total Tax Liability**

**Section C: Advance Tax Schedule**

- Table with columns:
  - Due Date
  - Required Payment
  - Actual Payment
  - Shortfall
  - Interest u/s 234C
- Total interest u/s 234C

**Section D: Interest u/s 234B**

- Required advance tax (90% of total)
- Actual advance tax paid
- Shortfall amount
- Interest rate and period
- Total interest u/s 234B

**Section E: TDS Credit**

- Itemized list of TDS from all sources
- Total TDS available for credit

**Section F: Amount Payable Today**

- Total tax liability
- Less: Advance tax paid
- Less: TDS credit
- Add: Interest u/s 234B
- Add: Interest u/s 234C
- **Net Tax Payable as Self-Assessment Tax**

**Section G: Payment Instructions**

- Challan 280 details for self-assessment tax
- Due date reminder (July 31, 2026 for filing ITR)
- Assessment Year: 2026-27

### Worksheet Features

- Print-friendly CSS
- Export to PDF
- Copy to clipboard
- Email option
- Detailed footnotes explaining each calculation
- Disclaimer about consulting a tax professional

## Additional Features

### Optional Enhancements

- **Scenario Comparison**: Allow users to see tax liability under both regimes side-by-side
- **What-if Calculator**: Adjust deduction amounts to see impact on tax
- **Penalty Minimization Tips**: Suggest optimal payment strategy for remaining months
- **Document Checklist**: Generate list of documents needed for ITR filing
- **Previous Year Import**: Allow uploading previous ITR JSON for pre-filling

### Data Validation

- Cross-validate dates (sale date > purchase date)
- Ensure advance tax payments don't exceed computed liability
- Warn if TDS seems unusually high/low
- Flag if foreign assets exceed ₹2.5 crore (Schedule FA requirement)

### Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- High contrast mode option

## Technical Implementation Notes

### State Management

```typescript
interface TaxState {
  personalInfo: PersonalInfo;
  salaryIncome: SalaryIncome | null;
  mfWithdrawals: MutualFundWithdrawal[];
  usStockSales: USStockSale[];
  otherIncome: OtherIncome[];
  deductions: Deductions;
  advanceTaxPaid: AdvanceTaxPayment[];
  calculationResults: TaxCalculationResults | null;
}
```

### Key Calculation Functions

- `calculateCapitalGains()`
- `calculateTaxLiability(regime: 'old' | 'new')`
- `calculateAdvanceTaxSchedule()`
- `calculateInterest234B()`
- `calculateInterest234C()`
- `generateWorksheet()`

### Data Persistence

- Save form state to localStorage after each step
- Option to export/import JSON for backup
- Clear data option with confirmation

### Error Handling

- Graceful handling of calculation errors
- User-friendly error messages
- Validation errors shown inline near fields
- Summary of all errors before proceeding

## Deliverables

1. Fully functional React + TypeScript app
2. README with setup instructions
3. Sample data for testing
4. Inline documentation for complex calculations
5. Brief user guide explaining each step

## Compliance Disclaimer

Include prominent disclaimer:

> "This calculator provides estimates based on information provided. Tax laws are complex and subject to interpretation. Always consult a qualified Chartered Accountant or tax professional before making tax payments or filing returns. This tool is for educational purposes only."

---

**Target User**: Individual taxpayers with multiple income sources who need to calculate advance tax liability for FY 2025-26 with penalty and interest for delayed payments.

**Success Criteria**: User can complete the wizard in 10-15 minutes and receive an accurate, detailed worksheet showing exactly what they owe in self-assessment tax today.
