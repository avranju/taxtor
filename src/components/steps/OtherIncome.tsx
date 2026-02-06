import { useForm } from 'react-hook-form';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Label from '@radix-ui/react-label';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';
import { useState } from 'react';

const incomeSchema = z
  .object({
    id: z.string(),
    description: z.string().min(1, 'Description is required'),
    amount: z.number().min(0, 'Amount cannot be negative'),
    tds: z.number().min(0, 'TDS cannot be negative'),
  })
  .refine(data => data.tds <= data.amount, {
    message: 'TDS cannot exceed income amount',
    path: ['tds'],
  });

const formSchema = z.object({
  incomes: z.array(incomeSchema),
});

type FormValues = z.infer<typeof formSchema>;

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

function generateId() {
  return crypto.randomUUID();
}

function createDefaultIncome(
  type: 'interest-savings' | 'interest-fd' | 'rental' | 'misc'
): FormValues['incomes'][0] {
  const descriptions = {
    'interest-savings': 'Interest from savings account',
    'interest-fd': 'Interest from fixed deposits',
    rental: 'Rental income',
    misc: 'Other income',
  };

  return {
    id: generateId(),
    description: descriptions[type],
    amount: 0,
    tds: 0,
  };
}

interface IncomeEntryCardProps {
  index: number;
  fieldId: string;
  watchedIncome: FormValues['incomes'][number] | undefined;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  onRemove: () => void;
  canRemove: boolean;
}

function IncomeEntryCard({
  index,
  fieldId,
  watchedIncome,
  register,
  errors,
  onRemove,
  canRemove,
}: IncomeEntryCardProps) {
  const entryErrors = errors.incomes?.[index];
  const totalIncome = Number(watchedIncome?.amount) || 0;
  const tdsAmount = Number(watchedIncome?.tds) || 0;
  const netIncome = totalIncome - tdsAmount;

  return (
    <div key={fieldId} className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Label.Root
              htmlFor={`incomes.${index}.description`}
              className="text-sm font-medium text-gray-700"
            >
              Income Source
            </Label.Root>
            <input
              id={`incomes.${index}.description`}
              type="text"
              placeholder="e.g. Interest from savings account"
              {...register(`incomes.${index}.description`)}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                entryErrors?.description ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
            {entryErrors?.description && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.description.message}</p>
            )}
          </div>

          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="ml-4 mt-7 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              title="Remove entry"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label.Root
              htmlFor={`incomes.${index}.amount`}
              className="text-sm font-medium text-gray-700"
            >
              Income Amount (INR) <span className="text-red-500">*</span>
            </Label.Root>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                ₹
              </span>
              <input
                id={`incomes.${index}.amount`}
                type="number"
                min={0}
                step={1}
                placeholder="0"
                {...register(`incomes.${index}.amount`, { valueAsNumber: true })}
                className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  entryErrors?.amount ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {entryErrors?.amount && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.amount.message}</p>
            )}
          </div>

          <div>
            <Label.Root
              htmlFor={`incomes.${index}.tds`}
              className="text-sm font-medium text-gray-700"
            >
              TDS Deducted (INR)
            </Label.Root>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                ₹
              </span>
              <input
                id={`incomes.${index}.tds`}
                type="number"
                min={0}
                step={1}
                placeholder="0"
                {...register(`incomes.${index}.tds`, { valueAsNumber: true })}
                className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  entryErrors?.tds ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {entryErrors?.tds && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.tds.message}</p>
            )}
          </div>
        </div>

        {totalIncome > 0 && (
          <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-blue-700">
                <span>Total Income</span>
                <span>{formatINR(totalIncome)}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>Less: TDS Deducted</span>
                <span>{formatINR(tdsAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-1">
                <span className="font-medium text-blue-900">Net Income</span>
                <span
                  className={`font-semibold ${netIncome >= 0 ? 'text-blue-900' : 'text-red-600'}`}
                >
                  {formatINR(netIncome)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function OtherIncome() {
  const otherIncome = useTaxStore(s => s.otherIncome);
  const setOtherIncome = useTaxStore(s => s.setOtherIncome);
  const nextStep = useTaxStore(s => s.nextStep);

  const [hasOtherIncome, setHasOtherIncome] = useState(otherIncome.length > 0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      incomes:
        otherIncome.length > 0
          ? otherIncome.map(income => ({
              id: income.id,
              description: income.description,
              amount: income.amount,
              tds: income.tds,
            }))
          : [
              createDefaultIncome('interest-savings'),
              createDefaultIncome('interest-fd'),
              createDefaultIncome('rental'),
              createDefaultIncome('misc'),
            ],
    },
  });

  const watchedIncomes = watch('incomes');

  const onSubmit = (data: FormValues) => {
    const entries = data.incomes
      .filter(income => income.amount > 0 || income.tds > 0 || income.description.trim() !== '')
      .map(income => {
        let category: 'interest' | 'rental' | 'misc';
        if (income.description.toLowerCase().includes('interest')) {
          category = 'interest';
        } else if (income.description.toLowerCase().includes('rental')) {
          category = 'rental';
        } else {
          category = 'misc';
        }

        return {
          id: income.id,
          description: income.description,
          amount: income.amount,
          tds: income.tds,
          category,
        };
      });
    setOtherIncome(entries);
    nextStep();
  };

  const onSkip = () => {
    setOtherIncome([]);
    nextStep();
  };

  const addIncomeEntry = (type: 'interest-savings' | 'interest-fd' | 'rental' | 'misc') => {
    const currentIncomes = watchedIncomes || [];
    const newEntry = createDefaultIncome(type);
    // Find the index to insert after similar entries
    let insertIndex = currentIncomes.length;
    for (let i = currentIncomes.length - 1; i >= 0; i--) {
      if (currentIncomes[i].description.includes(newEntry.description.split(' from')[0])) {
        insertIndex = i + 1;
        break;
      }
    }
    currentIncomes.splice(insertIndex, 0, newEntry);
  };

  if (!hasOtherIncome) {
    return (
      <form
        id={WIZARD_FORM_ID}
        onSubmit={e => {
          e.preventDefault();
          onSkip();
        }}
        className="space-y-6"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Other Income</h2>
          <p className="mt-1 text-sm text-gray-500">
            Interest, rental, and miscellaneous income with TDS
          </p>
        </div>

        <SkipCheckbox checked={hasOtherIncome} onChange={setHasOtherIncome} />

        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          No other income to report. Click <strong>Next</strong> to continue.
        </div>
      </form>
    );
  }

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Other Income</h2>
        <p className="mt-1 text-sm text-gray-500">
          Interest, rental, and miscellaneous income with TDS
        </p>
      </div>

      <SkipCheckbox checked={hasOtherIncome} onChange={setHasOtherIncome} />

      {watchedIncomes?.map((income, index) => (
        <IncomeEntryCard
          key={income.id}
          index={index}
          fieldId={income.id}
          watchedIncome={income}
          register={register}
          errors={errors}
          onRemove={() => {
            const currentIncomes = watchedIncomes || [];
            currentIncomes.splice(index, 1);
          }}
          canRemove={watchedIncomes.length > 1}
        />
      ))}

      {/* Quick Add Buttons */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Quick Add:</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addIncomeEntry('interest-savings')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            + Interest (Savings)
          </button>
          <button
            type="button"
            onClick={() => addIncomeEntry('interest-fd')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            + Interest (FD)
          </button>
          <button
            type="button"
            onClick={() => addIncomeEntry('rental')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            + Rental Income
          </button>
          <button
            type="button"
            onClick={() => addIncomeEntry('misc')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            + Other Income
          </button>
        </div>
      </div>

      {errors.incomes?.root && (
        <p className="text-sm text-red-600">{errors.incomes.root.message}</p>
      )}

      {/* Aggregate Summary */}
      {watchedIncomes?.length > 0 &&
        watchedIncomes.some(income => (Number(income.amount) || 0) > 0) && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-900">
              Aggregate Summary (
              {watchedIncomes.filter(income => (Number(income.amount) || 0) > 0).length} income
              {watchedIncomes.filter(income => (Number(income.amount) || 0) > 0).length !== 1
                ? 's'
                : ''}
              )
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-blue-700">Total Income</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(
                    watchedIncomes.reduce((sum, income) => sum + (Number(income.amount) || 0), 0)
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-blue-700">Total TDS</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(
                    watchedIncomes.reduce((sum, income) => sum + (Number(income.tds) || 0), 0)
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-1">
                <dt className="text-blue-700">Net Income</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(
                    watchedIncomes.reduce(
                      (sum, income) =>
                        sum + (Number(income.amount) || 0) - (Number(income.tds) || 0),
                      0
                    )
                  )}
                </dd>
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
        id="hasOtherIncome"
        checked={checked}
        onCheckedChange={c => onChange(c === true)}
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
      <Label.Root htmlFor="hasOtherIncome" className="cursor-pointer text-sm text-gray-700">
        I had other income during FY 2025-26
      </Label.Root>
    </div>
  );
}
