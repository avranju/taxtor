import { useTaxStore } from '../../store/tax-store';
import { ProgressBar } from './ProgressBar';
import { PersonalInfo } from '../steps/PersonalInfo';
import { SalaryIncome } from '../steps/SalaryIncome';
import { MfWithdrawals } from '../steps/MfWithdrawals';
import { UsStockIncome } from '../steps/UsStockIncome';
import { OtherIncome } from '../steps/OtherIncome';
import { Deductions } from '../steps/Deductions';
import { AdvanceTaxPayments } from '../steps/AdvanceTaxPayments';
import { TaxWorksheet } from '../worksheet/TaxWorksheet';

const STEPS = [
  PersonalInfo,
  SalaryIncome,
  MfWithdrawals,
  UsStockIncome,
  OtherIncome,
  Deductions,
  AdvanceTaxPayments,
  TaxWorksheet,
];

export const WIZARD_FORM_ID = 'wizard-step-form';

export function WizardShell() {
  const currentStep = useTaxStore(s => s.currentStep);
  const prevStep = useTaxStore(s => s.prevStep);
  const stepLabels = useTaxStore(s => s.stepLabels);

  const StepComponent = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === stepLabels.length - 1;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Taxtor</h1>
      <p className="mb-6 text-gray-600">
        Indian Advance Tax Calculator &mdash; FY 2025-26 (AY 2026-27)
      </p>

      <ProgressBar />

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <StepComponent />
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={prevStep}
          disabled={isFirstStep}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="submit"
          form={WIZARD_FORM_ID}
          className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
            isLastStep
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLastStep ? 'Calculate' : 'Next'}
        </button>
      </div>
    </div>
  );
}
