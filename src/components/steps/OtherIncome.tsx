import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Label from '@radix-ui/react-label';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';
import { useMemo, useState, useEffect } from 'react';

const otherIncomeEntrySchema = z
  .object({
    id: z.string(),
    description: z.string().min(1, 'Description is required'),
    category: z.enum(['interest', 'rental', 'misc']),
    amount: z.number().min(0, 'Amount cannot be negative'),
    tds: z.number().min(0, 'Cannot be negative'),
  })
  .refine(data => data.tds <= data.amount, {
    message: 'TDS cannot exceed amount',
    path: ['tds'],
  });

const formSchema = z.object({
  otherIncome: z.array(otherIncomeEntrySchema),
});

type FormValues = z.infer<typeof formSchema>;

const CATEGORIES = [
  { value: 'interest' as const, label: 'Interest', description: 'Savings, FD, etc.' },
  { value: 'rental' as const, label: 'Rental', description: 'House property income' },
  { value: 'misc' as const, label: 'Miscellaneous', description: 'Other taxable income' },
];

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

function generateId() {
  return crypto.randomUUID();
}

function createEmptyEntry() {
  return {
    id: generateId(),
    description: '',
    category: 'interest' as const,
    amount: 0,
    tds: 0,
  };
}

export function OtherIncome() {
  const otherIncome = useTaxStore(s => s.otherIncome);
  const setOtherIncome = useTaxStore(s => s.setOtherIncome);
  const nextStep = useTaxStore(s => s.nextStep);

  const [hasOtherIncome, setHasOtherIncome] = useState(otherIncome.length > 0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      otherIncome:
        otherIncome.length > 0
          ? otherIncome
          : [
              { ...createEmptyEntry(), description: 'Savings Account Interest', category: 'interest' },
              { ...createEmptyEntry(), description: 'Fixed Deposit Interest', category: 'interest' },
            ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'otherIncome',
  });

  const watchedIncome = watch('otherIncome');

  // Auto-uncheck if all entries are removed
  useEffect(() => {
    if (hasOtherIncome && watchedIncome.length === 0) {
      setHasOtherIncome(false);
    }
  }, [watchedIncome.length, hasOtherIncome]);

  const handleToggleHasIncome = (checked: boolean) => {
    setHasOtherIncome(checked);
    if (checked && watchedIncome.length === 0) {
      append(createEmptyEntry());
    }
  };

  const aggregateSummary = useMemo(() => {
    let totalAmount = 0;
    let totalTds = 0;
    const byCategory = {
      interest: 0,
      rental: 0,
      misc: 0,
    };

    for (const item of watchedIncome || []) {
      const amount = Number(item.amount) || 0;
      const tds = Number(item.tds) || 0;
      totalAmount += amount;
      totalTds += tds;
      if (item.category) {
        byCategory[item.category] += amount;
      }
    }

    return { totalAmount, totalTds, byCategory };
  }, [watchedIncome]);

  const onSubmit = (data: FormValues) => {
    setOtherIncome(data.otherIncome);
    nextStep();
  };

  const onSkip = () => {
    setOtherIncome([]);
    nextStep();
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
          <h2 className="text-xl font-semibold text-gray-900">Other Income Sources</h2>
          <p className="mt-1 text-sm text-gray-500">
            Report interest, rental income, and any other taxable sources
          </p>
        </div>

        <SkipCheckbox checked={hasOtherIncome} onChange={handleToggleHasIncome} />

        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          No other income to report. Click <strong>Next</strong> to continue.
        </div>
      </form>
    );
  }

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Other Income Sources</h2>
        <p className="mt-1 text-sm text-gray-500">
          Report interest, rental income, and any other taxable sources
        </p>
      </div>

      <SkipCheckbox checked={hasOtherIncome} onChange={handleToggleHasIncome} />

      <div className="space-y-4">
        {fields.map((field, index) => {
          const item = watchedIncome?.[index];
          const entryErrors = errors.otherIncome?.[index];

          return (
            <div
              key={field.id}
              className="relative space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <button
                type="button"
                onClick={() => remove(index)}
                className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
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

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Description */}
                <div className="sm:col-span-2">
                  <Label.Root
                    htmlFor={`otherIncome.${index}.description`}
                    className="text-sm font-medium text-gray-700"
                  >
                    Description <span className="text-red-500">*</span>
                  </Label.Root>
                  <input
                    id={`otherIncome.${index}.description`}
                    type="text"
                    placeholder="e.g. HDFC Savings Interest"
                    {...register(`otherIncome.${index}.description`)}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      entryErrors?.description
                        ? 'border-red-400 focus:ring-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  {entryErrors?.description && (
                    <p className="mt-1 text-sm text-red-600">{entryErrors.description.message}</p>
                  )}
                </div>

                {/* Category */}
                <div className="sm:col-span-2">
                  <Label.Root className="text-sm font-medium text-gray-700">
                    Category <span className="text-red-500">*</span>
                  </Label.Root>
                  <RadioGroup.Root
                    className="mt-2 flex flex-wrap gap-4"
                    value={item?.category || 'interest'}
                    onValueChange={value =>
                      setValue(`otherIncome.${index}.category`, value as 'interest' | 'rental' | 'misc', {
                        shouldValidate: true,
                      })
                    }
                  >
                    {CATEGORIES.map(cat => (
                      <div key={cat.value} className="flex items-center gap-2">
                        <RadioGroup.Item
                          value={cat.value}
                          id={`otherIncome-${index}-cat-${cat.value}`}
                          className="h-4 w-4 rounded-full border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <RadioGroup.Indicator className="flex items-center justify-center after:block after:h-1.5 after:w-1.5 after:rounded-full after:bg-white" />
                        </RadioGroup.Item>
                        <Label.Root
                          htmlFor={`otherIncome-${index}-cat-${cat.value}`}
                          className="cursor-pointer text-sm text-gray-700"
                        >
                          {cat.label} <span className="text-xs text-gray-400">({cat.description})</span>
                        </Label.Root>
                      </div>
                    ))}
                  </RadioGroup.Root>
                </div>

                {/* Amount */}
                <div>
                  <Label.Root
                    htmlFor={`otherIncome.${index}.amount`}
                    className="text-sm font-medium text-gray-700"
                  >
                    Amount <span className="text-red-500">*</span>
                  </Label.Root>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      ₹
                    </span>
                    <input
                      id={`otherIncome.${index}.amount`}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      {...register(`otherIncome.${index}.amount`, { valueAsNumber: true })}
                      className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        entryErrors?.amount ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {entryErrors?.amount && (
                    <p className="mt-1 text-sm text-red-600">{entryErrors.amount.message}</p>
                  )}
                </div>

                {/* TDS */}
                <div>
                  <Label.Root
                    htmlFor={`otherIncome.${index}.tds`}
                    className="text-sm font-medium text-gray-700"
                  >
                    TDS Deducted
                  </Label.Root>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      ₹
                    </span>
                    <input
                      id={`otherIncome.${index}.tds`}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      {...register(`otherIncome.${index}.tds`, { valueAsNumber: true })}
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
            </div>
          );
        })}
      </div>

      {/* Add Entry Button */}
      <button
        type="button"
        onClick={() => append(createEmptyEntry())}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Another Income Source
      </button>

      {/* Aggregate Summary */}
      {watchedIncome?.some(item => (Number(item.amount) || 0) > 0) && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-900">Total Other Income</p>
          <dl className="mt-2 space-y-1 text-sm">
            {aggregateSummary.byCategory.interest > 0 && (
              <div className="flex justify-between">
                <dt className="text-blue-700">Interest Income</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(aggregateSummary.byCategory.interest)}
                </dd>
              </div>
            )}
            {aggregateSummary.byCategory.rental > 0 && (
              <div className="flex justify-between">
                <dt className="text-blue-700">Rental Income</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(aggregateSummary.byCategory.rental)}
                </dd>
              </div>
            )}
            {aggregateSummary.byCategory.misc > 0 && (
              <div className="flex justify-between">
                <dt className="text-blue-700">Miscellaneous Income</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(aggregateSummary.byCategory.misc)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-blue-200 pt-1">
              <dt className="font-medium text-blue-900">Total Other Income</dt>
              <dd className="font-semibold text-blue-900">
                {formatINR(aggregateSummary.totalAmount)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-blue-700">Total TDS</dt>
              <dd className="font-medium text-blue-900">{formatINR(aggregateSummary.totalTds)}</dd>
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
        I had other income sources during FY 2025-26
      </Label.Root>
    </div>
  );
}