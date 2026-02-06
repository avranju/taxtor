import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Label from '@radix-ui/react-label';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';
import { useMemo } from 'react';

const MAX_80C = 150_000;
const MAX_80CCD1B = 50_000;

const deductionsSchema = z.object({
  section80C: z.number().min(0, 'Cannot be negative').max(10_000_000, 'Amount too large'),
  section80D: z.number().min(0, 'Cannot be negative').max(200_000, 'Amount too large'),
  section80CCD1B: z.number().min(0, 'Cannot be negative').max(10_000_000, 'Amount too large'),
  section80G: z.number().min(0, 'Cannot be negative').max(10_000_000, 'Amount too large'),
  section24b: z.number().min(0, 'Cannot be negative').max(10_000_000, 'Amount too large'),
  otherChapterVIA: z.number().min(0, 'Cannot be negative').max(10_000_000, 'Amount too large'),
});

type DeductionsForm = z.infer<typeof deductionsSchema>;

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export function Deductions() {
  const deductions = useTaxStore(s => s.deductions);
  const personalInfo = useTaxStore(s => s.personalInfo);
  const setDeductions = useTaxStore(s => s.setDeductions);
  const nextStep = useTaxStore(s => s.nextStep);

  const max80D = personalInfo.ageBracket === 'below60' ? 25_000 : 50_000;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<DeductionsForm>({
    resolver: zodResolver(deductionsSchema),
    defaultValues: {
      section80C: deductions.section80C,
      section80D: deductions.section80D,
      section80CCD1B: deductions.section80CCD1B,
      section80G: deductions.section80G,
      section24b: deductions.section24b,
      otherChapterVIA: deductions.otherChapterVIA,
    },
  });

  const watchedValues = watch();

  const computation = useMemo(() => {
    const s80C = Math.min(Number(watchedValues.section80C) || 0, MAX_80C);
    const s80D = Math.min(Number(watchedValues.section80D) || 0, max80D);
    const s80CCD1B = Math.min(Number(watchedValues.section80CCD1B) || 0, MAX_80CCD1B);
    const s80G = Number(watchedValues.section80G) || 0;
    const s24b = Number(watchedValues.section24b) || 0;
    const other = Number(watchedValues.otherChapterVIA) || 0;

    return {
      s80C,
      s80D,
      s80CCD1B,
      s80G,
      s24b,
      other,
      total: s80C + s80D + s80CCD1B + s80G + s24b + other,
    };
  }, [watchedValues, max80D]);

  const onSubmit = (data: DeductionsForm) => {
    setDeductions(data);
    nextStep();
  };

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Deductions &amp; Exemptions</h2>
        <p className="mt-1 text-sm text-gray-500">
          Maximize your tax savings under the Old Regime (Chapter VI-A)
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Section 80C */}
        <div className="space-y-1">
          <Label.Root htmlFor="section80C" className="text-sm font-medium text-gray-700">
            Section 80C
          </Label.Root>
          <p className="text-xs text-gray-400">PPF, ELSS, LIC, EPF, Home Loan Principal, etc.</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              ₹
            </span>
            <input
              id="section80C"
              type="number"
              step="0.01"
              placeholder="0"
              {...register('section80C', { valueAsNumber: true })}
              className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.section80C ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          <p className="text-[10px] text-gray-400">Max deduction allowed: ₹1,50,000</p>
          {errors.section80C && (
            <p className="mt-1 text-sm text-red-600">{errors.section80C.message}</p>
          )}
        </div>

        {/* Section 80D */}
        <div className="space-y-1">
          <Label.Root htmlFor="section80D" className="text-sm font-medium text-gray-700">
            Section 80D
          </Label.Root>
          <p className="text-xs text-gray-400">Health Insurance Premium</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              ₹
            </span>
            <input
              id="section80D"
              type="number"
              step="0.01"
              placeholder="0"
              {...register('section80D', { valueAsNumber: true })}
              className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.section80D ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          <p className="text-[10px] text-gray-400">
            Max allowed: {formatINR(max80D)} {personalInfo.ageBracket !== 'below60' && '(Senior Citizen)'}
          </p>
          {errors.section80D && (
            <p className="mt-1 text-sm text-red-600">{errors.section80D.message}</p>
          )}
        </div>

        {/* Section 80CCD(1B) */}
        <div className="space-y-1">
          <Label.Root htmlFor="section80CCD1B" className="text-sm font-medium text-gray-700">
            Section 80CCD(1B)
          </Label.Root>
          <p className="text-xs text-gray-400">NPS (Additional Deduction)</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              ₹
            </span>
            <input
              id="section80CCD1B"
              type="number"
              step="0.01"
              placeholder="0"
              {...register('section80CCD1B', { valueAsNumber: true })}
              className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.section80CCD1B ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          <p className="text-[10px] text-gray-400">Max deduction allowed: ₹50,000</p>
          {errors.section80CCD1B && (
            <p className="mt-1 text-sm text-red-600">{errors.section80CCD1B.message}</p>
          )}
        </div>

        {/* Section 24(b) */}
        <div className="space-y-1">
          <Label.Root htmlFor="section24b" className="text-sm font-medium text-gray-700">
            Section 24(b)
          </Label.Root>
          <p className="text-xs text-gray-400">Home Loan Interest</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              ₹
            </span>
            <input
              id="section24b"
              type="number"
              step="0.01"
              placeholder="0"
              {...register('section24b', { valueAsNumber: true })}
              className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.section24b ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.section24b && (
            <p className="mt-1 text-sm text-red-600">{errors.section24b.message}</p>
          )}
        </div>

        {/* Section 80G */}
        <div className="space-y-1">
          <Label.Root htmlFor="section80G" className="text-sm font-medium text-gray-700">
            Section 80G
          </Label.Root>
          <p className="text-xs text-gray-400">Donations to Charitable Institutions</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              ₹
            </span>
            <input
              id="section80G"
              type="number"
              step="0.01"
              placeholder="0"
              {...register('section80G', { valueAsNumber: true })}
              className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.section80G ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.section80G && (
            <p className="mt-1 text-sm text-red-600">{errors.section80G.message}</p>
          )}
        </div>

        {/* Other Chapter VI-A */}
        <div className="space-y-1">
          <Label.Root htmlFor="otherChapterVIA" className="text-sm font-medium text-gray-700">
            Other Chapter VI-A
          </Label.Root>
          <p className="text-xs text-gray-400">80E, 80TTA/TTB, 80U, etc.</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              ₹
            </span>
            <input
              id="otherChapterVIA"
              type="number"
              step="0.01"
              placeholder="0"
              {...register('otherChapterVIA', { valueAsNumber: true })}
              className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.otherChapterVIA ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.otherChapterVIA && (
            <p className="mt-1 text-sm text-red-600">{errors.otherChapterVIA.message}</p>
          )}
        </div>
      </div>

      {/* Summary of effective deductions */}
      {computation.total > 0 && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-900">Effective Deductions Summary</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-blue-700">Section 80C (Limited to ₹1.5L)</dt>
              <dd className="font-medium text-blue-900">{formatINR(computation.s80C)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-blue-700">Section 80D (Limited to {formatINR(max80D)})</dt>
              <dd className="font-medium text-blue-900">{formatINR(computation.s80D)}</dd>
            </div>
            {computation.s80CCD1B > 0 && (
              <div className="flex justify-between">
                <dt className="text-blue-700">Section 80CCD(1B) (Limited to ₹50k)</dt>
                <dd className="font-medium text-blue-900">{formatINR(computation.s80CCD1B)}</dd>
              </div>
            )}
            {(computation.s80G > 0 || computation.s24b > 0 || computation.other > 0) && (
              <div className="flex justify-between">
                <dt className="text-blue-700">Other Deductions</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(computation.s80G + computation.s24b + computation.other)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-blue-200 pt-1">
              <dt className="font-bold text-blue-900">Total Effective Deductions</dt>
              <dd className="font-bold text-blue-900">{formatINR(computation.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[10px] text-blue-600">
            * Note: Deductions are only applicable under the Old Tax Regime.
          </p>
        </div>
      )}
    </form>
  );
}