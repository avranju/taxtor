import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Label from '@radix-ui/react-label';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';
import { useState, useMemo } from 'react';
import { differenceInMonths, parseISO } from 'date-fns';

const FY_START = '2025-04-01';
const DEBT_LTCG_THRESHOLD_MONTHS = 36;
const EQUITY_LTCG_THRESHOLD_MONTHS = 12;

const swpSchema = z
  .object({
    fundType: z.enum(['debt', 'equity']),
    dateOfInvestment: z.string().min(1, 'Date of investment is required'),
    totalWithdrawal: z.number().min(1, 'Total withdrawal amount is required'),
    costBasis: z.number().min(0, 'Cannot be negative'),
    tds: z.number().min(0, 'Cannot be negative'),
  })
  .refine((data) => data.costBasis <= data.totalWithdrawal, {
    message: 'Cost basis cannot exceed total withdrawal',
    path: ['costBasis'],
  })
  .refine((data) => data.tds <= data.totalWithdrawal, {
    message: 'TDS cannot exceed total withdrawal',
    path: ['tds'],
  });

type SwpForm = z.infer<typeof swpSchema>;

function computeHoldingMonths(dateOfInvestment: string): number {
  if (!dateOfInvestment) return 0;
  const investDate = parseISO(dateOfInvestment);
  const fyStart = parseISO(FY_START);
  const months = differenceInMonths(fyStart, investDate);
  return Math.max(months, 0);
}

function getGainsClassification(
  fundType: 'debt' | 'equity',
  holdingMonths: number
): { type: 'LTCG' | 'STCG'; threshold: number } {
  const threshold =
    fundType === 'debt' ? DEBT_LTCG_THRESHOLD_MONTHS : EQUITY_LTCG_THRESHOLD_MONTHS;
  return {
    type: holdingMonths > threshold ? 'LTCG' : 'STCG',
    threshold,
  };
}

const FUND_TYPES = [
  {
    value: 'debt',
    label: 'Debt-Oriented',
    description: 'LTCG if held > 36 months',
  },
  {
    value: 'equity',
    label: 'Equity-Oriented',
    description: 'LTCG if held > 12 months',
  },
] as const;

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export function SwpIncome() {
  const swpIncome = useTaxStore((s) => s.swpIncome);
  const setSwpIncome = useTaxStore((s) => s.setSwpIncome);
  const nextStep = useTaxStore((s) => s.nextStep);

  const [hasSwp, setHasSwp] = useState(swpIncome !== null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SwpForm>({
    resolver: zodResolver(swpSchema),
    defaultValues: {
      fundType: swpIncome?.fundType ?? 'debt',
      dateOfInvestment: swpIncome?.dateOfInvestment ?? '',
      totalWithdrawal: swpIncome?.totalWithdrawal ?? 0,
      costBasis: swpIncome?.costBasis ?? 0,
      tds: swpIncome?.tds ?? 0,
    },
  });

  const watchedFundType = watch('fundType');
  const watchedInvestDate = watch('dateOfInvestment');
  const watchedWithdrawal = watch('totalWithdrawal');
  const watchedCost = watch('costBasis');

  const holdingMonths = useMemo(
    () => computeHoldingMonths(watchedInvestDate),
    [watchedInvestDate]
  );

  const classification = useMemo(
    () => getGainsClassification(watchedFundType, holdingMonths),
    [watchedFundType, holdingMonths]
  );

  const capitalGain = useMemo(() => {
    const withdrawal = Number(watchedWithdrawal) || 0;
    const cost = Number(watchedCost) || 0;
    return withdrawal - cost;
  }, [watchedWithdrawal, watchedCost]);

  const onSubmit = (data: SwpForm) => {
    setSwpIncome({
      fundType: data.fundType,
      dateOfInvestment: data.dateOfInvestment,
      totalWithdrawal: data.totalWithdrawal,
      costBasis: data.costBasis,
      holdingPeriodMonths: holdingMonths,
      tds: data.tds,
    });
    nextStep();
  };

  const onSkip = () => {
    setSwpIncome(null);
    nextStep();
  };

  if (!hasSwp) {
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
          <h2 className="text-xl font-semibold text-gray-900">SWP Income</h2>
          <p className="mt-1 text-sm text-gray-500">
            Systematic Withdrawal Plan from mutual funds during FY 2025-26
          </p>
        </div>

        <SkipCheckbox checked={hasSwp} onChange={setHasSwp} />

        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          No SWP income to report. Click <strong>Next</strong> to continue.
        </div>
      </form>
    );
  }

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">SWP Income</h2>
        <p className="mt-1 text-sm text-gray-500">
          Systematic Withdrawal Plan from mutual funds during FY 2025-26
        </p>
      </div>

      <SkipCheckbox checked={hasSwp} onChange={setHasSwp} />

      {/* Fund Type */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">
          Fund Type <span className="text-red-500">*</span>
        </legend>
        <RadioGroup.Root
          className="mt-2 space-y-2"
          value={watchedFundType}
          onValueChange={(value) =>
            setValue('fundType', value as SwpForm['fundType'], {
              shouldValidate: true,
            })
          }
        >
          {FUND_TYPES.map((ft) => (
            <div key={ft.value} className="flex items-center gap-3">
              <RadioGroup.Item
                value={ft.value}
                id={`fund-${ft.value}`}
                className="h-4 w-4 rounded-full border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <RadioGroup.Indicator className="flex items-center justify-center after:block after:h-1.5 after:w-1.5 after:rounded-full after:bg-white" />
              </RadioGroup.Item>
              <Label.Root
                htmlFor={`fund-${ft.value}`}
                className="cursor-pointer text-sm text-gray-700"
              >
                {ft.label}{' '}
                <span className="text-gray-400">({ft.description})</span>
              </Label.Root>
            </div>
          ))}
        </RadioGroup.Root>
      </fieldset>

      {/* Date of Investment */}
      <div>
        <Label.Root htmlFor="dateOfInvestment" className="text-sm font-medium text-gray-700">
          Date of Investment <span className="text-red-500">*</span>
        </Label.Root>
        <p className="mt-0.5 text-xs text-gray-400">
          When the fund units were originally purchased
        </p>
        <input
          id="dateOfInvestment"
          type="date"
          max={FY_START}
          {...register('dateOfInvestment')}
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.dateOfInvestment
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300'
          }`}
        />
        {errors.dateOfInvestment && (
          <p className="mt-1 text-sm text-red-600">{errors.dateOfInvestment.message}</p>
        )}
      </div>

      {/* Holding Period (auto-calculated) */}
      {watchedInvestDate && (
        <div>
          <Label.Root className="text-sm font-medium text-gray-700">
            Holding Period
          </Label.Root>
          <div
            className={`mt-1 rounded-md border px-3 py-2 text-sm ${
              classification.type === 'LTCG'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {holdingMonths} month{holdingMonths !== 1 ? 's' : ''} as of Apr 2025
            <span className="ml-2 font-medium">
              &rarr; {classification.type}
            </span>
            <span className="ml-1 text-xs opacity-75">
              (threshold: &gt;{classification.threshold} months for{' '}
              {watchedFundType === 'debt' ? 'debt' : 'equity'} funds)
            </span>
          </div>
        </div>
      )}

      {/* Total SWP Withdrawals */}
      <div>
        <Label.Root htmlFor="totalWithdrawal" className="text-sm font-medium text-gray-700">
          Total SWP Withdrawals <span className="text-red-500">*</span>
        </Label.Root>
        <p className="mt-0.5 text-xs text-gray-400">
          Total amount received from all SWP redemptions during FY 2025-26
        </p>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            ₹
          </span>
          <input
            id="totalWithdrawal"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            {...register('totalWithdrawal', { valueAsNumber: true })}
            className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.totalWithdrawal
                ? 'border-red-400 focus:ring-red-500'
                : 'border-gray-300'
            }`}
          />
        </div>
        {errors.totalWithdrawal && (
          <p className="mt-1 text-sm text-red-600">{errors.totalWithdrawal.message}</p>
        )}
      </div>

      {/* Cost of Acquisition */}
      <div>
        <Label.Root htmlFor="costBasis" className="text-sm font-medium text-gray-700">
          Cost of Acquisition <span className="text-red-500">*</span>
        </Label.Root>
        <p className="mt-0.5 text-xs text-gray-400">
          Original purchase price of the redeemed fund units
        </p>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            ₹
          </span>
          <input
            id="costBasis"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            {...register('costBasis', { valueAsNumber: true })}
            className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.costBasis
                ? 'border-red-400 focus:ring-red-500'
                : 'border-gray-300'
            }`}
          />
        </div>
        {errors.costBasis && (
          <p className="mt-1 text-sm text-red-600">{errors.costBasis.message}</p>
        )}
      </div>

      {/* TDS */}
      <div>
        <Label.Root htmlFor="tds" className="text-sm font-medium text-gray-700">
          TDS Deducted on SWP
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

      {/* Capital Gains Summary */}
      {(Number(watchedWithdrawal) || 0) > 0 && watchedInvestDate && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-900">Capital Gains from SWP</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-blue-700">Total Withdrawals</dt>
              <dd className="font-medium text-blue-900">
                {formatINR(Number(watchedWithdrawal) || 0)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-blue-700">Less: Cost of Acquisition</dt>
              <dd className="font-medium text-blue-900">
                &minus; {formatINR(Number(watchedCost) || 0)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-blue-200 pt-1">
              <dt className="font-medium text-blue-900">
                {classification.type === 'LTCG'
                  ? 'Long-Term Capital Gain'
                  : 'Short-Term Capital Gain'}
              </dt>
              <dd
                className={`font-semibold ${
                  capitalGain >= 0 ? 'text-blue-900' : 'text-red-600'
                }`}
              >
                {formatINR(capitalGain)}
              </dd>
            </div>
            <div className="pt-1 text-xs text-blue-600">
              {classification.type === 'LTCG'
                ? 'Taxed at 20% with indexation benefit'
                : watchedFundType === 'debt'
                  ? 'Added to total income, taxed at slab rates'
                  : 'Taxed at 15% flat rate'}
            </div>
          </dl>
        </div>
      )}
    </form>
  );
}

function SkipCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox.Root
        id="hasSwp"
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
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
      <Label.Root htmlFor="hasSwp" className="cursor-pointer text-sm text-gray-700">
        I had SWP income during FY 2025-26
      </Label.Root>
    </div>
  );
}
