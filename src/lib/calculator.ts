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
  ltcg: number;
  stcg: number;
  taxableAsSlab: number;
  totalTds: number;
}

export function calculateMFGains(withdrawals: MutualFundWithdrawal[]): GainSummary {
  let ltcg = 0;
  let stcg = 0;
  let taxableAsSlab = 0;
  let totalTds = 0;

  for (const w of withdrawals) {
    totalTds += w.tds;
    const gain = w.amountWithdrawn - w.costBasis;
    if (gain <= 0) continue;

    if (w.fundType === 'equity') {
      if (w.holdingPeriodMonths > EQUITY_LTCG_THRESHOLD_MONTHS) {
        ltcg += gain;
      } else {
        stcg += gain;
      }
    } else {
      // Debt
      if (w.holdingPeriodMonths > DEBT_LTCG_THRESHOLD_MONTHS) {
        // LTCG with indexation
        const indexedCost = getIndexedCost(w.costBasis, w.dateOfInvestment, w.dateOfWithdrawal);
        const indexedGain = Math.max(0, w.amountWithdrawn - indexedCost);
        ltcg += indexedGain;
      } else {
        // STCG taxable at slab
        taxableAsSlab += gain;
      }
    }
  }

  return { ltcg, stcg, taxableAsSlab, totalTds };
}

export function calculateUSStockGains(sales: USStockSale[]): GainSummary {
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

  return { ltcg, stcg, taxableAsSlab: 0, totalTds };
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
  const slabIncomeBase = salaryNet + totalOtherIncome + mfSummary.taxableAsSlab;

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
    totalTax += mfSummary.stcg * EQUITY_STCG_RATE;
    // LTCG: 12.5% on gain > 1.25L
    if (mfSummary.ltcg > EQUITY_LTCG_EXEMPTION) {
      totalTax += (mfSummary.ltcg - EQUITY_LTCG_EXEMPTION) * EQUITY_LTCG_RATE;
    }

    // Tax on Debt MF LTCG: 20% (already indexed in gain computation)
    totalTax += mfSummary.ltcg * DEBT_LTCG_RATE; // Note: simplified, req says 20%

    // Tax on US Stocks
    // STCG: 15% (per req)
    totalTax += usSummary.stcg * US_STOCK_STCG_RATE;
    // LTCG: 20%
    totalTax += usSummary.ltcg * US_STOCK_LTCG_RATE;

    const surcharge = calculateSurcharge(totalTax, taxableIncome + mfSummary.ltcg + mfSummary.stcg + usSummary.ltcg + usSummary.stcg);
    totalTax += surcharge;
    totalTax += totalTax * CESS_RATE;

    return { totalTax, taxableIncome: taxableIncome + mfSummary.ltcg + mfSummary.stcg + usSummary.ltcg + usSummary.stcg };
  };

  const oldResult = computeRegimeTax('old');
  const newResult = computeRegimeTax('new');

  const recommendedRegime: TaxRegime = oldResult.totalTax <= newResult.totalTax ? 'old' : 'new';
  const finalTax = recommendedRegime === 'old' ? oldResult.totalTax : newResult.totalTax;

  // Advance Tax Schedule
  const schedule: AdvanceTaxScheduleItem[] = [
    { quarter: 'June', dueDate: '2025-06-15', cumulativePercentage: 15, requiredAmount: finalTax * 0.15, actualPaid: 0, shortfall: 0 },
    { quarter: 'September', dueDate: '2025-09-15', cumulativePercentage: 45, requiredAmount: finalTax * 0.45, actualPaid: 0, shortfall: 0 },
    { quarter: 'December', dueDate: '2025-12-15', cumulativePercentage: 75, requiredAmount: finalTax * 0.75, actualPaid: 0, shortfall: 0 },
    { quarter: 'March', dueDate: '2026-03-15', cumulativePercentage: 100, requiredAmount: finalTax * 1.00, actualPaid: 0, shortfall: 0 },
  ];

  advanceTaxPaid.forEach(p => {
    const item = schedule.find(s => s.quarter.toLowerCase() === p.quarter.toLowerCase());
    if (item) item.actualPaid += p.amountPaid;
  });

  // Calculate shortfalls (cumulative)
  let cumulativePaid = 0;
  schedule.forEach(item => {
    cumulativePaid += item.actualPaid;
    item.shortfall = Math.max(0, item.requiredAmount - cumulativePaid);
  });

  // Interest 234C
  const interest234C = schedule.reduce((acc, item) => {
    if (item.shortfall > 0) {
      // 1% per month for 3 months (except last installment which is 1 month)
      const months = item.quarter === 'March' ? 1 : 3;
      return acc + (item.shortfall * 0.01 * months);
    }
    return acc;
  }, 0);

  // Interest 234B
  let interest234B = 0;
  if (cumulativePaid < finalTax * 0.90) {
    const shortfall = finalTax - cumulativePaid;
    // 1% per month from April to July (4 months)
    interest234B = shortfall * 0.01 * 4;
  }

  return {
    totalIncome: slabIncomeBase + mfSummary.ltcg + mfSummary.stcg + usSummary.ltcg + usSummary.stcg,
    taxableIncome: recommendedRegime === 'old' ? oldResult.taxableIncome : newResult.taxableIncome,
    taxOldRegime: oldResult.totalTax,
    taxNewRegime: newResult.totalTax,
    recommendedRegime,
    advanceTaxSchedule: schedule,
    interest234B,
    interest234C,
    totalTdsCredited: totalTds,
    netAmountPayable: Math.max(0, finalTax + interest234B + interest234C - cumulativePaid - totalTds),
  };
}