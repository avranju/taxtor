export type TaxpayerCategory = 'individual' | 'huf' | 'firm';
export type ResidentialStatus = 'resident' | 'non-resident' | 'rnor';
export type AgeBracket = 'below60' | '60to80' | 'above80';
export type TaxRegime = 'old' | 'new';

export interface PersonalInfo {
  name: string;
  pan: string;
  category: TaxpayerCategory;
  residentialStatus: ResidentialStatus;
  ageBracket: AgeBracket;
  financialYear: string;
  dateOfUnemployment: string | null;
}

export interface SalaryIncome {
  employmentStartDate: string;
  employmentEndDate: string;
  grossSalary: number;
  professionalTax: number;
  standardDeduction: number;
  tds: number;
}

export interface SWPIncome {
  fundType: 'debt' | 'equity';
  dateOfInvestment: string;
  totalWithdrawal: number;
  costBasis: number;
  holdingPeriodMonths: number;
  tds: number;
}

export interface USStockIncome {
  saleProceedsUSD: number;
  saleProceedsINR: number;
  costBasisUSD: number;
  costBasisINR: number;
  holdingPeriodMonths: number;
}

export interface OtherIncome {
  id: string;
  description: string;
  amount: number;
  tds: number;
  category: 'interest' | 'rental' | 'misc';
}

export interface Deductions {
  section80C: number;
  section80D: number;
  section80CCD1B: number;
  section80G: number;
  section24b: number;
  otherChapterVIA: number;
}

export interface AdvanceTaxPayment {
  quarter: 'june' | 'september' | 'december' | 'march';
  dueDate: string;
  amountPaid: number;
  datePaid: string;
}

export interface TaxCalculationResults {
  totalIncome: number;
  taxableIncome: number;
  taxOldRegime: number;
  taxNewRegime: number;
  recommendedRegime: TaxRegime;
  advanceTaxSchedule: AdvanceTaxScheduleItem[];
  interest234B: number;
  interest234C: number;
  totalTdsCredited: number;
  netAmountPayable: number;
}

export interface AdvanceTaxScheduleItem {
  quarter: string;
  dueDate: string;
  cumulativePercentage: number;
  requiredAmount: number;
  actualPaid: number;
  shortfall: number;
}

export interface TaxState {
  personalInfo: PersonalInfo;
  salaryIncome: SalaryIncome | null;
  swpIncome: SWPIncome | null;
  usStockIncome: USStockIncome | null;
  otherIncome: OtherIncome[];
  deductions: Deductions;
  advanceTaxPaid: AdvanceTaxPayment[];
  calculationResults: TaxCalculationResults | null;
}
