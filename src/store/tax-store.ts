import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TaxState,
  PersonalInfo,
  SalaryIncome,
  MutualFundWithdrawal,
  USStockSale,
  OtherIncome,
  Deductions,
  AdvanceTaxPayment,
  TaxCalculationResults,
} from '../types/tax';

const STEP_LABELS = [
  'Personal Information',
  'Salary Income',
  'MF Withdrawals',
  'US Stock Income',
  'Other Income',
  'Deductions',
  'Advance Tax Payments',
] as const;

interface TaxStore extends TaxState {
  currentStep: number;
  highestStepReached: number;
  stepLabels: readonly string[];
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  setPersonalInfo: (info: PersonalInfo) => void;
  setSalaryIncome: (income: SalaryIncome | null) => void;
  setMfWithdrawals: (withdrawals: MutualFundWithdrawal[]) => void;
  setUsStockSales: (sales: USStockSale[]) => void;
  setOtherIncome: (income: OtherIncome[]) => void;
  setDeductions: (deductions: Deductions) => void;
  setAdvanceTaxPaid: (payments: AdvanceTaxPayment[]) => void;
  setCalculationResults: (results: TaxCalculationResults | null) => void;
  clearAll: () => void;
  exportData: () => TaxState;
  importData: (data: TaxState) => void;
}

const initialPersonalInfo: PersonalInfo = {
  name: '',
  pan: '',
  category: 'individual',
  residentialStatus: 'resident',
  ageBracket: 'below60',
  financialYear: '2025-26',
  dateOfUnemployment: null,
};

const initialDeductions: Deductions = {
  section80C: 0,
  section80D: 0,
  section80CCD1B: 0,
  section80G: 0,
  section24b: 0,
  otherChapterVIA: 0,
};

const initialState: TaxState = {
  personalInfo: initialPersonalInfo,
  salaryIncome: null,
  mfWithdrawals: [],
  usStockSales: [],
  otherIncome: [],
  deductions: initialDeductions,
  advanceTaxPaid: [],
  calculationResults: null,
};

export const useTaxStore = create<TaxStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      currentStep: 0,
      highestStepReached: 0,
      stepLabels: STEP_LABELS,

      setCurrentStep: (step) => set({ currentStep: step }),
      nextStep: () => {
        const { currentStep, highestStepReached } = get();
        if (currentStep < STEP_LABELS.length - 1) {
          const next = currentStep + 1;
          set({
            currentStep: next,
            highestStepReached: Math.max(highestStepReached, next),
          });
        }
      },
      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },
      goToStep: (step) => {
        const { highestStepReached } = get();
        if (step >= 0 && step <= highestStepReached) {
          set({ currentStep: step });
        }
      },

      setPersonalInfo: (info) => set({ personalInfo: info }),
      setSalaryIncome: (income) => set({ salaryIncome: income }),
      setMfWithdrawals: (withdrawals) => set({ mfWithdrawals: withdrawals }),
      setUsStockSales: (sales) => set({ usStockSales: sales }),
      setOtherIncome: (income) => set({ otherIncome: income }),
      setDeductions: (deductions) => set({ deductions }),
      setAdvanceTaxPaid: (payments) => set({ advanceTaxPaid: payments }),
      setCalculationResults: (results) => set({ calculationResults: results }),

      clearAll: () => set({ ...initialState, currentStep: 0, highestStepReached: 0 }),

      exportData: () => {
        const state = get();
        return {
          personalInfo: state.personalInfo,
          salaryIncome: state.salaryIncome,
          mfWithdrawals: state.mfWithdrawals,
          usStockSales: state.usStockSales,
          otherIncome: state.otherIncome,
          deductions: state.deductions,
          advanceTaxPaid: state.advanceTaxPaid,
          calculationResults: state.calculationResults,
        };
      },

      importData: (data) => set({ ...data, currentStep: 0, highestStepReached: 0 }),
    }),
    {
      name: 'taxtor-storage',
    }
  )
);
