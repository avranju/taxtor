import type {
  TaxState,
  TaxRegime,
  TaxCalculationResults,
  AdvanceTaxScheduleItem,
} from '../types/tax';

export interface MfGainEntry {
  id: string;
  gain: number;
  gainsType: 'LTCG' | 'STCG';
}

export function calculateCapitalGains(_state: TaxState): {
  mfGains: MfGainEntry[];
  mfLtcgTotal: number;
  mfStcgTotal: number;
  usStockGains: number;
  usStockGainsType: 'LTCG' | 'STCG';
} {
  // TODO: implement
  return {
    mfGains: [],
    mfLtcgTotal: 0,
    mfStcgTotal: 0,
    usStockGains: 0,
    usStockGainsType: 'STCG',
  };
}

export function calculateTaxLiability(
  _state: TaxState,
  _regime: TaxRegime
): number {
  // TODO: implement slab rates, cess, surcharge, rebate
  return 0;
}

export function calculateAdvanceTaxSchedule(
  _state: TaxState
): AdvanceTaxScheduleItem[] {
  // TODO: implement required vs actual installments
  return [];
}

export function calculateInterest234B(_state: TaxState): number {
  // TODO: implement 1% per month simple interest on shortfall
  return 0;
}

export function calculateInterest234C(_state: TaxState): number {
  // TODO: implement 1% per month simple interest on deferred installments
  return 0;
}

export function generateWorksheet(_state: TaxState): TaxCalculationResults {
  // TODO: produce full tax computation output
  return {
    totalIncome: 0,
    taxableIncome: 0,
    taxOldRegime: 0,
    taxNewRegime: 0,
    recommendedRegime: 'new',
    advanceTaxSchedule: [],
    interest234B: 0,
    interest234C: 0,
    totalTdsCredited: 0,
    netAmountPayable: 0,
  };
}
