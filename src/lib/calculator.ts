import type {
  TaxState,
  TaxRegime,
  TaxCalculationResults,
  AdvanceTaxScheduleItem,
  MutualFundWithdrawal,
  USStockSale,
} from '../types/tax';
import { parseISO, getYear } from 'date-fns';

// Constants for FY 2025-26 (AY 2026-27)
const CESS_RATE = 0.04;

// Thresholds for Capital Gains
const DEBT_LTCG_THRESHOLD_MONTHS = 36;
const EQUITY_LTCG_THRESHOLD_MONTHS = 12;
const US_STOCK_LTCG_THRESHOLD_MONTHS = 24;

// Tax Rates for Capital Gains (FY 2025-26)
const EQUITY_LTCG_RATE = 0.125;
const EQUITY_LTCG_EXEMPTION = 125_000;
const EQUITY_STCG_RATE = 0.20;
const DEBT_LTCG_RATE = 0.20; // With indexation
const US_STOCK_LTCG_RATE = 0.20; // With indexation
const US_STOCK_STCG_RATE = 0.15; // Per req.md "15% flat"

// Indexation placeholder (CII)
// Since this is for FY 2025-26, we'd normally need the full table.
// For this prototype, we'll approximate indexation as 4% per year.
function getIndexedCost(cost: number, purchaseDate: string, saleDate: string): number {
  if (!purchaseDate || !saleDate) return cost;
  const pDate = parseISO(purchaseDate);
  const sDate = parseISO(saleDate);
  const years = Math.max(0, getYear(sDate) - getYear(pDate));
  // Simple 4% annual indexation approximation
  return cost * Math.pow(1.04, years);
}

export interface GainSummary {
  equityLtcg: number;
  equityStcg: number;
  debtLtcg: number;
  debtStcgAsSlab: number;
  totalTds: number;
}

export interface USGainSummary {
  ltcg: number;
  stcg: number;
  totalTds: number;
}

export function calculateMFGains(withdrawals: MutualFundWithdrawal[]): GainSummary {
  let equityLtcg = 0;
  let equityStcg = 0;
  let debtLtcg = 0;
  let debtStcgAsSlab = 0;
  let totalTds = 0;

  for (const w of withdrawals) {
    totalTds += w.tds;
    const gain = w.amountWithdrawn - w.costBasis;
    if (gain <= 0) continue;

    if (w.fundType === 'equity') {
      if (w.holdingPeriodMonths > EQUITY_LTCG_THRESHOLD_MONTHS) {
        equityLtcg += gain;
      } else {
        equityStcg += gain;
      }
    } else {
      // Debt
      if (w.holdingPeriodMonths > DEBT_LTCG_THRESHOLD_MONTHS) {
        // LTCG with indexation
        const indexedCost = getIndexedCost(w.costBasis, w.dateOfInvestment, w.dateOfWithdrawal);
        const indexedGain = Math.max(0, w.amountWithdrawn - indexedCost);
        debtLtcg += indexedGain;
      } else {
        // STCG taxable at slab
        debtStcgAsSlab += gain;
      }
    }
  }

  return { equityLtcg, equityStcg, debtLtcg, debtStcgAsSlab, totalTds };
}

export function calculateUSStockGains(sales: USStockSale[]): USGainSummary {
  let ltcg = 0;
  let stcg = 0;
  let totalTds = 0;

  for (const s of sales) {
    totalTds += s.tds;
    const gain = s.saleProceedsINR - s.costBasisINR - s.brokerageCharges;
    if (gain <= 0) continue;

    if (s.holdingPeriodMonths > US_STOCK_LTCG_THRESHOLD_MONTHS) {
      // LTCG with indexation
      const indexedCost = getIndexedCost(s.costBasisINR, s.dateOfPurchase, s.dateOfSale);
      const indexedGain = Math.max(0, s.saleProceedsINR - indexedCost - s.brokerageCharges);
      ltcg += indexedGain;
    } else {
      // STCG per req.md is 15% flat
      stcg += gain;
    }
  }

  return { ltcg, stcg, totalTds };
}

function calculateSlabTax(income: number, regime: TaxRegime): number {
  let tax = 0;
  if (regime === 'old') {
    // 0-2.5L: Nil
    // 2.5-5L: 5%
    // 5-10L: 20%
    // >10L: 30%
    if (income <= 250_000) return 0;
    if (income <= 500_000) {
      tax = (income - 250_000) * 0.05;
    } else if (income <= 1_000_000) {
      tax = 12_500 + (income - 500_000) * 0.20;
    } else {
      tax = 112_500 + (income - 1_000_000) * 0.30;
    }
    // Rebate u/s 87A for Old Regime: if income <= 5L
    if (income <= 500_000) return 0;
  } else {
    // New Regime FY 2025-26
    // 0-3L: Nil
    // 3-7L: 5%
    // 7-10L: 10%
    // 10-12L: 15%
    // 12-15L: 20%
    // >15L: 30%
    if (income <= 300_000) return 0;
    if (income <= 700_000) {
      tax = (income - 300_000) * 0.05;
    } else if (income <= 1_000_000) {
      tax = 20_000 + (income - 700_000) * 0.10;
    } else if (income <= 1_200_000) {
      tax = 50_000 + (income - 1_000_000) * 0.15;
    } else if (income <= 1_500_000) {
      tax = 80_000 + (income - 1_200_000) * 0.20;
    } else {
      tax = 140_000 + (income - 1_500_000) * 0.30;
    }
    // Rebate u/s 87A for New Regime: if income <= 7L
    if (income <= 700_000) return 0;
  }
  return tax;
}

function calculateSurcharge(tax: number, income: number): number {
  if (income <= 5_000_000) return 0;
  if (income <= 10_000_000) return tax * 0.10;
  if (income <= 20_000_000) return tax * 0.15;
  return tax * 0.25; // Simplified
}

export function generateWorksheet(state: TaxState): TaxCalculationResults {
  const { salaryIncome, mfWithdrawals, usStockSales, otherIncome, deductions, advanceTaxPaid } = state;

  // 1. MF Gains
  const mfSummary = calculateMFGains(mfWithdrawals);
  // 2. US Stock Gains
  const usSummary = calculateUSStockGains(usStockSales);
  // 3. Other Income
  const totalOtherIncome = otherIncome.reduce((acc, curr) => acc + curr.amount, 0);
  const otherIncomeTds = otherIncome.reduce((acc, curr) => acc + curr.tds, 0);

  // Gross Total Income (excluding special rate gains)
  const salaryNet = salaryIncome ? Math.max(0, salaryIncome.grossSalary - salaryIncome.professionalTax - salaryIncome.standardDeduction) : 0;
  const slabIncomeBase = salaryNet + totalOtherIncome + mfSummary.debtStcgAsSlab;

  // Total TDS
  const totalTds = (salaryIncome?.tds || 0) + mfSummary.totalTds + usSummary.totalTds + otherIncomeTds;

  // Function to calculate tax for a regime
  const computeRegimeTax = (regime: TaxRegime) => {
    let taxableIncome = slabIncomeBase;
    if (regime === 'old') {
      const totalDeductions = Math.min(deductions.section80C, 150_000) +
        Math.min(deductions.section80D, state.personalInfo.ageBracket === 'below60' ? 25_000 : 50_000) +
        Math.min(deductions.section80CCD1B, 50_000) +
        deductions.section80G + deductions.section24b + deductions.otherChapterVIA;
      taxableIncome = Math.max(0, taxableIncome - totalDeductions);
    }

    // Tax on slab income
    let totalTax = calculateSlabTax(taxableIncome, regime);

    // Tax on Equity MF Gains
    // STCG: 20%
    totalTax += mfSummary.equityStcg * EQUITY_STCG_RATE;
    // LTCG: 12.5% on gain > 1.25L
    if (mfSummary.equityLtcg > EQUITY_LTCG_EXEMPTION) {
      totalTax += (mfSummary.equityLtcg - EQUITY_LTCG_EXEMPTION) * EQUITY_LTCG_RATE;
    }

    // Tax on Debt MF LTCG: 20% (already indexed in gain computation)
    totalTax += mfSummary.debtLtcg * DEBT_LTCG_RATE;

    // Tax on US Stocks
    // STCG: 15% (per req)
    totalTax += usSummary.stcg * US_STOCK_STCG_RATE;
    // LTCG: 20%
    totalTax += usSummary.ltcg * US_STOCK_LTCG_RATE;

    const taxableIncomeWithSpecialRates = taxableIncome
      + mfSummary.equityLtcg
      + mfSummary.equityStcg
      + mfSummary.debtLtcg
      + usSummary.ltcg
      + usSummary.stcg;
    const surcharge = calculateSurcharge(totalTax, taxableIncomeWithSpecialRates);
    totalTax += surcharge;
    totalTax += totalTax * CESS_RATE;

    return { totalTax, taxableIncome: taxableIncomeWithSpecialRates };
  };

  const oldResult = computeRegimeTax('old');
  const newResult = computeRegimeTax('new');

  const recommendedRegime: TaxRegime = oldResult.totalTax <= newResult.totalTax ? 'old' : 'new';
  const finalTax = recommendedRegime === 'old' ? oldResult.totalTax : newResult.totalTax;
  const assessedTax = Math.max(0, finalTax - totalTds);
  const isResidentSenior = state.personalInfo.residentialStatus === 'resident' && state.personalInfo.ageBracket !== 'below60';
  const hasBusinessOrProfessionalIncome = state.personalInfo.hasBusinessOrProfessionalIncome ?? true;
  const exemptFromAdvanceTax = isResidentSenior && !hasBusinessOrProfessionalIncome;
  const isAdvanceTaxApplicable = !exemptFromAdvanceTax && assessedTax > 10_000;
  const advanceTaxBase = isAdvanceTaxApplicable ? assessedTax : 0;

  // Advance Tax Schedule
  const schedule: AdvanceTaxScheduleItem[] = [
    { quarter: 'June', dueDate: '2025-06-15', cumulativePercentage: 15, requiredAmount: advanceTaxBase * 0.15, actualPaid: 0, shortfall: 0 },
    { quarter: 'September', dueDate: '2025-09-15', cumulativePercentage: 45, requiredAmount: advanceTaxBase * 0.45, actualPaid: 0, shortfall: 0 },
    { quarter: 'December', dueDate: '2025-12-15', cumulativePercentage: 75, requiredAmount: advanceTaxBase * 0.75, actualPaid: 0, shortfall: 0 },
    { quarter: 'March', dueDate: '2026-03-15', cumulativePercentage: 100, requiredAmount: advanceTaxBase * 1.00, actualPaid: 0, shortfall: 0 },
  ];

  const validPayments = advanceTaxPaid
    .map(p => ({
      amount: p.amountPaid,
      paidOn: parseISO(p.datePaid || p.dueDate),
    }))
    .filter(p => p.amount > 0 && !Number.isNaN(p.paidOn.getTime()));

  const paidThroughMarch31 = validPayments.reduce((acc, p) => {
    return p.paidOn <= parseISO('2026-03-31') ? acc + p.amount : acc;
  }, 0);
  const totalAdvanceTaxPaid = validPayments.reduce((acc, p) => acc + p.amount, 0);

  // Calculate shortfalls based on cumulative paid by each statutory due date.
  schedule.forEach(item => {
    const dueDate = parseISO(item.dueDate);
    const cumulativePaidByDueDate = validPayments.reduce((acc, p) => {
      return p.paidOn <= dueDate ? acc + p.amount : acc;
    }, 0);
    item.actualPaid = cumulativePaidByDueDate;
    item.shortfall = Math.max(0, item.requiredAmount - cumulativePaidByDueDate);
  });

  // Interest 234C
  const interest234C = isAdvanceTaxApplicable
    ? schedule.reduce((acc, item) => {
      if (item.shortfall > 0) {
        // 1% per month for 3 months (except last installment which is 1 month)
        const months = item.quarter === 'March' ? 1 : 3;
        return acc + (item.shortfall * 0.01 * months);
      }
      return acc;
    }, 0)
    : 0;

  // Interest 234B
  let interest234B = 0;
  if (isAdvanceTaxApplicable && paidThroughMarch31 < assessedTax * 0.90) {
    const required90Percent = assessedTax * 0.90;
    const shortfall = required90Percent - paidThroughMarch31;
    // 1% per month from April to July (4 months)
    interest234B = shortfall * 0.01 * 4;
  }

  return {
    totalIncome: slabIncomeBase
      + mfSummary.equityLtcg
      + mfSummary.equityStcg
      + mfSummary.debtLtcg
      + usSummary.ltcg
      + usSummary.stcg,
    taxableIncome: recommendedRegime === 'old' ? oldResult.taxableIncome : newResult.taxableIncome,
    taxOldRegime: oldResult.totalTax,
    taxNewRegime: newResult.totalTax,
    recommendedRegime,
    advanceTaxSchedule: schedule,
    interest234B,
    interest234C,
    totalTdsCredited: totalTds,
    netAmountPayable: Math.max(0, assessedTax + interest234B + interest234C - totalAdvanceTaxPaid),
  };
}
