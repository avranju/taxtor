import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Label from '@radix-ui/react-label';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';
import { useState, useMemo } from 'react';
import {
  differenceInMonths,
  parseISO,
  startOfMonth,
  addMonths,
  isAfter,
} from 'date-fns';

const FY_START = '2025-04-01';
const FY_END = '2026-03-31';
const STANDARD_DEDUCTION_MAX = 50_000;

const salarySchema = z
  .object({
    employmentStartDate: z.string().min(1, 'Start date is required'),
    employmentEndDate: z.string().min(1, 'End date is required'),
    grossSalary: z.number().min(1, 'Gross salary is required'),
    professionalTax: z.number().min(0, 'Cannot be negative'),
    tds: z.number().min(0, 'Cannot be negative'),
  })
  .refine(
    (data) => {
      const start = parseISO(data.employmentStartDate);
      const end = parseISO(data.employmentEndDate);
      return !isAfter(start, end);
    },
    { message: 'Start date must be on or before end date', path: ['employmentStartDate'] }
  )
  .refine(
    (data) => data.professionalTax <= data.grossSalary,
    {
      message: 'Professional tax cannot exceed gross salary',
      path: ['professionalTax'],
    }
  )
  .refine(
    (data) => data.tds <= data.grossSalary,
    { message: 'TDS cannot exceed gross salary', path: ['tds'] }
  );

type SalaryForm = z.infer<typeof salarySchema>;

function computeEmploymentMonths(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 12;
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (isAfter(start, end)) return 0;

  // Count full months + partial month counts as 1
  const startMonth = startOfMonth(start);
  const endMonth = startOfMonth(end);
  const fullMonths = differenceInMonths(addMonths(endMonth, 1), startMonth);
  return Math.min(Math.max(fullMonths, 1), 12);
}

function computeStandardDeduction(
  grossSalary: number,
  professionalTax: number,
  months: number
): number {
  const proRata = Math.round((STANDARD_DEDUCTION_MAX * months) / 12);
  return Math.min(proRata, Math.max(grossSalary - professionalTax, 0));
}

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export function SalaryIncome() {
  const salaryIncome = useTaxStore((s) => s.salaryIncome);
  const personalInfo = useTaxStore((s) => s.personalInfo);
  const setSalaryIncome = useTaxStore((s) => s.setSalaryIncome);
  const nextStep = useTaxStore((s) => s.nextStep);

  const defaultEndDate =
    personalInfo.dateOfUnemployment ?? FY_END;

  const [hasSalary, setHasSalary] = useState(salaryIncome !== null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SalaryForm>({
    resolver: zodResolver(salarySchema),
    defaultValues: {
      employmentStartDate: salaryIncome?.employmentStartDate ?? FY_START,
      employmentEndDate: salaryIncome?.employmentEndDate ?? defaultEndDate,
      grossSalary: salaryIncome?.grossSalary ?? 0,
      professionalTax: salaryIncome?.professionalTax ?? 0,
      tds: salaryIncome?.tds ?? 0,
    },
  });

  const watchedStart = watch('employmentStartDate');
  const watchedEnd = watch('employmentEndDate');
  const watchedGross = watch('grossSalary');
  const watchedPT = watch('professionalTax');

  const employmentMonths = useMemo(
    () => computeEmploymentMonths(watchedStart, watchedEnd),
    [watchedStart, watchedEnd]
  );

  const standardDeduction = useMemo(
    () =>
      computeStandardDeduction(
        Number(watchedGross) || 0,
        Number(watchedPT) || 0,
        employmentMonths
      ),
    [watchedGross, watchedPT, employmentMonths]
  );

  const netSalary = useMemo(() => {
    const gross = Number(watchedGross) || 0;
    const pt = Number(watchedPT) || 0;
    return Math.max(gross - pt - standardDeduction, 0);
  }, [watchedGross, watchedPT, standardDeduction]);

  const onSubmit = (data: SalaryForm) => {
    setSalaryIncome({
      employmentStartDate: data.employmentStartDate,
      employmentEndDate: data.employmentEndDate,
      grossSalary: data.grossSalary,
      professionalTax: data.professionalTax,
      standardDeduction,
      tds: data.tds,
    });
    nextStep();
  };

  const onSkip = () => {
    setSalaryIncome(null);
    nextStep();
  };

  // When skipped, render a simple form that just advances
  if (!hasSalary) {
    return (
      <form
        id={WIZARD_FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          onSkip();
        }}
        className="space-y-6"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Salary Income</h2>
          <p className="mt-1 text-sm text-gray-500">
            Employment income details for FY 2025-26
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox.Root
            id="hasSalary"
            checked={hasSalary}
            onCheckedChange={(checked) => setHasSalary(checked === true)}
            className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Checkbox.Indicator>
              <svg
                className="h-3.5 w-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </Checkbox.Indicator>
          </Checkbox.Root>
          <Label.Root htmlFor="hasSalary" className="cursor-pointer text-sm text-gray-700">
            I had salary income during FY 2025-26
          </Label.Root>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          No salary income to report. Click <strong>Next</strong> to continue.
        </div>
      </form>
    );
  }

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Salary Income</h2>
        <p className="mt-1 text-sm text-gray-500">
          Employment income details for FY 2025-26
        </p>
      </div>

      {/* Has salary toggle */}
      <div className="flex items-center gap-3">
        <Checkbox.Root
          id="hasSalary"
          checked={hasSalary}
          onCheckedChange={(checked) => setHasSalary(checked === true)}
          className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Checkbox.Indicator>
            <svg
              className="h-3.5 w-3.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </Checkbox.Indicator>
        </Checkbox.Root>
        <Label.Root htmlFor="hasSalary" className="cursor-pointer text-sm text-gray-700">
          I had salary income during FY 2025-26
        </Label.Root>
      </div>

      {/* Employment Period */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">
          Employment Period <span className="text-red-500">*</span>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <Label.Root htmlFor="employmentStartDate" className="text-xs text-gray-500">
              From
            </Label.Root>
            <input
              id="employmentStartDate"
              type="date"
              min={FY_START}
              max={FY_END}
              {...register('employmentStartDate')}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.employmentStartDate
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {errors.employmentStartDate && (
              <p className="mt-1 text-sm text-red-600">
                {errors.employmentStartDate.message}
              </p>
            )}
          </div>
          <div>
            <Label.Root htmlFor="employmentEndDate" className="text-xs text-gray-500">
              To
            </Label.Root>
            <input
              id="employmentEndDate"
              type="date"
              min={FY_START}
              max={FY_END}
              {...register('employmentEndDate')}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.employmentEndDate
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {errors.employmentEndDate && (
              <p className="mt-1 text-sm text-red-600">
                {errors.employmentEndDate.message}
              </p>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {employmentMonths} month{employmentMonths !== 1 ? 's' : ''} of employment
        </p>
      </fieldset>

      {/* Gross Salary */}
      <div>
        <Label.Root htmlFor="grossSalary" className="text-sm font-medium text-gray-700">
          Gross Salary Received <span className="text-red-500">*</span>
        </Label.Root>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            ₹
          </span>
          <input
            id="grossSalary"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            {...register('grossSalary', { valueAsNumber: true })}
            className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.grossSalary ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
            }`}
          />
        </div>
        {errors.grossSalary && (
          <p className="mt-1 text-sm text-red-600">{errors.grossSalary.message}</p>
        )}
      </div>

      {/* Professional Tax */}
      <div>
        <Label.Root htmlFor="professionalTax" className="text-sm font-medium text-gray-700">
          Professional Tax Paid
        </Label.Root>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            ₹
          </span>
          <input
            id="professionalTax"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            {...register('professionalTax', { valueAsNumber: true })}
            className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.professionalTax
                ? 'border-red-400 focus:ring-red-500'
                : 'border-gray-300'
            }`}
          />
        </div>
        {errors.professionalTax && (
          <p className="mt-1 text-sm text-red-600">{errors.professionalTax.message}</p>
        )}
      </div>

      {/* Standard Deduction (auto-calculated) */}
      <div>
        <Label.Root className="text-sm font-medium text-gray-700">
          Standard Deduction
        </Label.Root>
        <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {formatINR(standardDeduction)}
          {employmentMonths < 12 && (
            <span className="ml-2 text-xs text-gray-400">
              (pro-rated: {formatINR(STANDARD_DEDUCTION_MAX)} &times; {employmentMonths}/12)
            </span>
          )}
        </div>
      </div>

      {/* TDS */}
      <div>
        <Label.Root htmlFor="tds" className="text-sm font-medium text-gray-700">
          TDS Deducted from Salary
        </Label.Root>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            ₹
          </span>
          <input
            id="tds"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            {...register('tds', { valueAsNumber: true })}
            className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.tds ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
            }`}
          />
        </div>
        {errors.tds && (
          <p className="mt-1 text-sm text-red-600">{errors.tds.message}</p>
        )}
      </div>

      {/* Net Salary Summary */}
      {(Number(watchedGross) || 0) > 0 && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-900">Income from Salary</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-blue-700">Gross Salary</dt>
              <dd className="font-medium text-blue-900">{formatINR(Number(watchedGross) || 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-blue-700">Less: Professional Tax</dt>
              <dd className="font-medium text-blue-900">
                &minus; {formatINR(Number(watchedPT) || 0)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-blue-700">Less: Standard Deduction</dt>
              <dd className="font-medium text-blue-900">
                &minus; {formatINR(standardDeduction)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-blue-200 pt-1">
              <dt className="font-medium text-blue-900">Net Taxable Salary</dt>
              <dd className="font-semibold text-blue-900">{formatINR(netSalary)}</dd>
            </div>
          </dl>
        </div>
      )}
    </form>
  );
}
