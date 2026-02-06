import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Label from '@radix-ui/react-label';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';
import { useState, useMemo, useRef, useEffect } from 'react';
import { differenceInMonths, parseISO, parse, format } from 'date-fns';

const DEBT_LTCG_THRESHOLD_MONTHS = 36;
const EQUITY_LTCG_THRESHOLD_MONTHS = 12;

const withdrawalSchema = z
  .object({
    id: z.string(),
    fundName: z.string(),
    fundType: z.enum(['debt', 'equity']),
    dateOfInvestment: z.string().min(1, 'Date of investment is required'),
    dateOfWithdrawal: z.string(),
    amountWithdrawn: z.number().min(1, 'Amount withdrawn is required'),
    costBasis: z.number().min(0, 'Cannot be negative'),
    tds: z.number().min(0, 'Cannot be negative'),
  })
  .refine(data => data.costBasis <= data.amountWithdrawn, {
    message: 'Cost basis cannot exceed amount withdrawn',
    path: ['costBasis'],
  })
  .refine(data => data.tds <= data.amountWithdrawn, {
    message: 'TDS cannot exceed amount withdrawn',
    path: ['tds'],
  });

const formSchema = z.object({
  withdrawals: z.array(withdrawalSchema).min(1, 'Add at least one withdrawal'),
});

type FormValues = z.infer<typeof formSchema>;

function computeHoldingMonths(dateOfInvestment: string, dateOfWithdrawal: string): number {
  if (!dateOfInvestment) return 0;
  const investDate = parseISO(dateOfInvestment);
  const endDate = dateOfWithdrawal ? parseISO(dateOfWithdrawal) : parseISO('2025-04-01');
  const months = differenceInMonths(endDate, investDate);
  return Math.max(months, 0);
}

function getGainsClassification(
  fundType: 'debt' | 'equity',
  holdingMonths: number
): { type: 'LTCG' | 'STCG'; threshold: number } {
  const threshold = fundType === 'debt' ? DEBT_LTCG_THRESHOLD_MONTHS : EQUITY_LTCG_THRESHOLD_MONTHS;
  return {
    type: holdingMonths > threshold ? 'LTCG' : 'STCG',
    threshold,
  };
}

const FUND_TYPES = [
  { value: 'debt' as const, label: 'Debt', description: 'LTCG if held > 36 months' },
  { value: 'equity' as const, label: 'Equity', description: 'LTCG if held > 12 months' },
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

function createEmptyWithdrawal() {
  return {
    id: generateId(),
    fundName: '',
    fundType: 'equity' as const,
    dateOfInvestment: '',
    dateOfWithdrawal: '',
    amountWithdrawn: 0,
    costBasis: 0,
    tds: 0,
  };
}

export function MfWithdrawals() {
  const mfWithdrawals = useTaxStore(s => s.mfWithdrawals);
  const setMfWithdrawals = useTaxStore(s => s.setMfWithdrawals);
  const nextStep = useTaxStore(s => s.nextStep);

  const [hasMfWithdrawals, setHasMfWithdrawals] = useState(mfWithdrawals.length > 0);
  const [collapsedEntries, setCollapsedEntries] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      withdrawals:
        mfWithdrawals.length > 0
          ? mfWithdrawals.map(w => ({
              id: w.id,
              fundName: w.fundName,
              fundType: w.fundType,
              dateOfInvestment: w.dateOfInvestment,
              dateOfWithdrawal: w.dateOfWithdrawal,
              amountWithdrawn: w.amountWithdrawn,
              costBasis: w.costBasis,
              tds: w.tds,
            }))
          : [createEmptyWithdrawal()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'withdrawals',
  });

  const watchedWithdrawals = watch('withdrawals');

  // Auto-uncheck if all entries are removed
  useEffect(() => {
    if (hasMfWithdrawals && watchedWithdrawals.length === 0) {
      setHasMfWithdrawals(false);
    }
  }, [watchedWithdrawals.length, hasMfWithdrawals]);

  const handleToggleHasMfWithdrawals = (checked: boolean) => {
    setHasMfWithdrawals(checked);
    if (checked && watchedWithdrawals.length === 0) {
      append(createEmptyWithdrawal());
    }
  };

  const toggleCollapse = (index: number) => {
    setCollapsedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const aggregateSummary = useMemo(() => {
    let totalWithdrawals = 0;
    let totalCost = 0;
    let totalLtcg = 0;
    let totalStcg = 0;
    let totalTds = 0;

    for (const w of watchedWithdrawals || []) {
      const amount = Number(w.amountWithdrawn) || 0;
      const cost = Number(w.costBasis) || 0;
      const tds = Number(w.tds) || 0;
      const gain = amount - cost;
      const holdingMonths = computeHoldingMonths(w.dateOfInvestment, w.dateOfWithdrawal);
      const classification = getGainsClassification(w.fundType, holdingMonths);

      totalWithdrawals += amount;
      totalCost += cost;
      totalTds += tds;

      if (classification.type === 'LTCG') {
        totalLtcg += gain;
      } else {
        totalStcg += gain;
      }
    }

    return { totalWithdrawals, totalCost, totalLtcg, totalStcg, totalTds };
  }, [watchedWithdrawals]);

  const onSubmit = (data: FormValues) => {
    const entries = data.withdrawals.map(w => ({
      id: w.id,
      fundName: w.fundName,
      fundType: w.fundType,
      dateOfInvestment: w.dateOfInvestment,
      dateOfWithdrawal: w.dateOfWithdrawal,
      amountWithdrawn: w.amountWithdrawn,
      costBasis: w.costBasis,
      holdingPeriodMonths: computeHoldingMonths(w.dateOfInvestment, w.dateOfWithdrawal),
      tds: w.tds,
    }));
    setMfWithdrawals(entries);
    nextStep();
  };

  const onSkip = () => {
    setMfWithdrawals([]);
    nextStep();
  };

  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) return;

      // Robust CSV splitting by comma outside quotes
      const splitCsv = (line: string) => {
        const parts = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim());
        return parts;
      };

      // Parse header to find column indices
      const headers = splitCsv(lines[0]).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
      const findIdx = (name: string) => headers.indexOf(name.toLowerCase());

      const idx = {
        fundName: findIdx('Fund Name'),
        fundType: findIdx('Fund Type'),
        purchaseDate: findIdx('Purchase Date'),
        purchaseValue: findIdx('Purchase Value'),
        redemptionDate: findIdx('Redemption Date'),
        redemptionValue: findIdx('Redemption Value'),
      };

      // Skip header
      const dataLines = lines.slice(1);
      const newEntries: z.infer<typeof withdrawalSchema>[] = [];
      
      for (const line of dataLines) {
        if (!line.trim()) continue;

        const parts = splitCsv(line);
        const clean = parts.map(p => p.replace(/^"|"$/g, '').replace(/,/g, '').trim());

        try {
          const fundName = idx.fundName !== -1 ? parts[idx.fundName].replace(/^"|"$/g, '') : 'Imported Fund';
          const fundTypeRaw = idx.fundType !== -1 ? clean[idx.fundType].toLowerCase() : 'equity';
          const fundType = fundTypeRaw.includes('debt') ? ('debt' as const) : ('equity' as const);
          
          const purchaseDateStr = idx.purchaseDate !== -1 ? parts[idx.purchaseDate].replace(/^"|"$/g, '') : '';
          const redemptionDateStr = idx.redemptionDate !== -1 ? parts[idx.redemptionDate].replace(/^"|"$/g, '') : '';

          if (!purchaseDateStr || !redemptionDateStr) continue;

          // Parse "Dec 29, 2021" or "Dec 29 2021"
          const parseDate = (d: string) => {
            // Handle both "Dec 29, 2021" and potential variations
            return parse(d.replace(',', ''), 'MMM d yyyy', new Date());
          };

          const pDate = parseDate(purchaseDateStr);
          const rDate = parseDate(redemptionDateStr);

          const amountWithdrawn = idx.redemptionValue !== -1 ? parseFloat(clean[idx.redemptionValue]) : 0;
          const costBasis = idx.purchaseValue !== -1 ? parseFloat(clean[idx.purchaseValue]) : 0;

          const entry = {
            id: generateId(),
            fundName: fundName || 'Imported Fund',
            fundType,
            dateOfInvestment: format(pDate, 'yyyy-MM-dd'),
            dateOfWithdrawal: format(rDate, 'yyyy-MM-dd'),
            amountWithdrawn,
            costBasis,
            tds: 0,
          };

          if (!isNaN(entry.amountWithdrawn) && !isNaN(entry.costBasis)) {
            newEntries.push(entry);
          }
        } catch (err) {
          console.error('Failed to parse CSV line:', line, err);
        }
      }

      if (newEntries.length > 0) {
        // If we only have the default empty entry, remove it
        if (fields.length === 1 && !watchedWithdrawals[0].dateOfInvestment && watchedWithdrawals[0].amountWithdrawn === 0) {
          remove(0);
        }
        append(newEntries);
        setHasMfWithdrawals(true);
      }
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDeleteAll = () => {
    if (window.confirm('Are you sure you want to delete all rows?')) {
      remove();
    }
  };

  if (!hasMfWithdrawals) {
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
          <h2 className="text-xl font-semibold text-gray-900">Mutual Fund Withdrawals</h2>
          <p className="mt-1 text-sm text-gray-500">
            Redemptions from mutual funds during FY 2025-26
          </p>
        </div>

        <SkipCheckbox checked={hasMfWithdrawals} onChange={handleToggleHasMfWithdrawals} />

        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            No mutual fund withdrawals to report. Click <strong>Next</strong> to continue or import from CSV.
          </div>
          
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleCsvImport}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import from CSV
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Mutual Fund Withdrawals</h2>
          <p className="mt-1 text-sm text-gray-500">
            Redemptions from mutual funds during FY 2025-26
          </p>
        </div>
        
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleCsvImport}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import from CSV
          </button>
          <button
            type="button"
            onClick={handleDeleteAll}
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete All Rows
          </button>
        </div>
      </div>

      <SkipCheckbox checked={hasMfWithdrawals} onChange={handleToggleHasMfWithdrawals} />

      {fields.map((field, index) => {
        const w = watchedWithdrawals?.[index];
        const holdingMonths = w ? computeHoldingMonths(w.dateOfInvestment, w.dateOfWithdrawal) : 0;
        const classification = w
          ? getGainsClassification(w.fundType, holdingMonths)
          : { type: 'STCG' as const, threshold: 36 };
        const capitalGain = (Number(w?.amountWithdrawn) || 0) - (Number(w?.costBasis) || 0);
        const isCollapsed = collapsedEntries.has(index);
        const entryErrors = errors.withdrawals?.[index];

        return (
          <div key={field.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
            {/* Card Header */}
            <div
              className="flex cursor-pointer items-center justify-between px-4 py-3"
              onClick={() => toggleCollapse(index)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                  {index + 1}
                </span>
                <div className="text-sm">
                  <span className="font-medium text-gray-900">
                    {w?.fundName || `Withdrawal #${index + 1}`}
                  </span>
                  <span className="ml-2 text-gray-500">
                    {w?.fundType === 'equity' ? 'Equity' : 'Debt'}
                  </span>
                  {(Number(w?.amountWithdrawn) || 0) > 0 && (
                    <span className="ml-2 text-gray-500">
                      {formatINR(Number(w?.amountWithdrawn) || 0)}
                    </span>
                  )}
                  {w?.dateOfInvestment && (
                    <span
                      className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        classification.type === 'LTCG'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {classification.type}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      remove(index);
                      setCollapsedEntries(prev => {
                        const next = new Set<number>();
                        for (const i of prev) {
                          if (i < index) next.add(i);
                          else if (i > index) next.add(i - 1);
                        }
                        return next;
                      });
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
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
                <svg
                  className={`h-4 w-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Card Body */}
            {!isCollapsed && (
              <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                <input type="hidden" {...register(`withdrawals.${index}.id`)} />

                {/* Fund Name */}
                <div>
                  <Label.Root
                    htmlFor={`withdrawals.${index}.fundName`}
                    className="text-sm font-medium text-gray-700"
                  >
                    Fund Name
                  </Label.Root>
                  <input
                    id={`withdrawals.${index}.fundName`}
                    type="text"
                    placeholder="e.g. HDFC Balanced Advantage"
                    {...register(`withdrawals.${index}.fundName`)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Fund Type */}
                <fieldset>
                  <legend className="text-sm font-medium text-gray-700">
                    Fund Type <span className="text-red-500">*</span>
                  </legend>
                  <RadioGroup.Root
                    className="mt-2 flex gap-4"
                    value={w?.fundType || 'debt'}
                    onValueChange={value =>
                      setValue(`withdrawals.${index}.fundType`, value as 'debt' | 'equity', {
                        shouldValidate: true,
                      })
                    }
                  >
                    {FUND_TYPES.map(ft => (
                      <div key={ft.value} className="flex items-center gap-2">
                        <RadioGroup.Item
                          value={ft.value}
                          id={`withdrawals-${index}-fund-${ft.value}`}
                          className="h-4 w-4 rounded-full border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <RadioGroup.Indicator className="flex items-center justify-center after:block after:h-1.5 after:w-1.5 after:rounded-full after:bg-white" />
                        </RadioGroup.Item>
                        <Label.Root
                          htmlFor={`withdrawals-${index}-fund-${ft.value}`}
                          className="cursor-pointer text-sm text-gray-700"
                        >
                          {ft.label} <span className="text-gray-400">({ft.description})</span>
                        </Label.Root>
                      </div>
                    ))}
                  </RadioGroup.Root>
                </fieldset>

                {/* Date of Investment */}
                <div>
                  <Label.Root
                    htmlFor={`withdrawals.${index}.dateOfInvestment`}
                    className="text-sm font-medium text-gray-700"
                  >
                    Date of Investment <span className="text-red-500">*</span>
                  </Label.Root>
                  <input
                    id={`withdrawals.${index}.dateOfInvestment`}
                    type="date"
                    {...register(`withdrawals.${index}.dateOfInvestment`)}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      entryErrors?.dateOfInvestment
                        ? 'border-red-400 focus:ring-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  {entryErrors?.dateOfInvestment && (
                    <p className="mt-1 text-sm text-red-600">
                      {entryErrors.dateOfInvestment.message}
                    </p>
                  )}
                </div>

                {/* Date of Withdrawal */}
                <div>
                  <Label.Root
                    htmlFor={`withdrawals.${index}.dateOfWithdrawal`}
                    className="text-sm font-medium text-gray-700"
                  >
                    Date of Withdrawal
                  </Label.Root>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Leave empty to use FY start date (Apr 2025)
                  </p>
                  <input
                    id={`withdrawals.${index}.dateOfWithdrawal`}
                    type="date"
                    min="2025-04-01"
                    max="2026-03-31"
                    {...register(`withdrawals.${index}.dateOfWithdrawal`)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Holding Period Badge */}
                {w?.dateOfInvestment && (
                  <div
                    className={`rounded-md border px-3 py-2 text-sm ${
                      classification.type === 'LTCG'
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {holdingMonths} month{holdingMonths !== 1 ? 's' : ''}
                    {w.dateOfWithdrawal ? '' : ' as of Apr 2025'}
                    <span className="ml-2 font-medium">&rarr; {classification.type}</span>
                    <span className="ml-1 text-xs opacity-75">
                      (threshold: &gt;{classification.threshold} months for{' '}
                      {w.fundType === 'equity' ? 'equity' : 'debt'} funds)
                    </span>
                  </div>
                )}

                {/* Amount Withdrawn */}
                <div>
                  <Label.Root
                    htmlFor={`withdrawals.${index}.amountWithdrawn`}
                    className="text-sm font-medium text-gray-700"
                  >
                    Amount Withdrawn <span className="text-red-500">*</span>
                  </Label.Root>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      ₹
                    </span>
                    <input
                      id={`withdrawals.${index}.amountWithdrawn`}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      {...register(`withdrawals.${index}.amountWithdrawn`, {
                        valueAsNumber: true,
                      })}
                      className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        entryErrors?.amountWithdrawn
                          ? 'border-red-400 focus:ring-red-500'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {entryErrors?.amountWithdrawn && (
                    <p className="mt-1 text-sm text-red-600">
                      {entryErrors.amountWithdrawn.message}
                    </p>
                  )}
                </div>

                {/* Cost of Acquisition */}
                <div>
                  <Label.Root
                    htmlFor={`withdrawals.${index}.costBasis`}
                    className="text-sm font-medium text-gray-700"
                  >
                    Cost of Acquisition <span className="text-red-500">*</span>
                  </Label.Root>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      ₹
                    </span>
                    <input
                      id={`withdrawals.${index}.costBasis`}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      {...register(`withdrawals.${index}.costBasis`, {
                        valueAsNumber: true,
                      })}
                      className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        entryErrors?.costBasis
                          ? 'border-red-400 focus:ring-red-500'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {entryErrors?.costBasis && (
                    <p className="mt-1 text-sm text-red-600">{entryErrors.costBasis.message}</p>
                  )}
                </div>

                {/* TDS */}
                <div>
                  <Label.Root
                    htmlFor={`withdrawals.${index}.tds`}
                    className="text-sm font-medium text-gray-700"
                  >
                    TDS Deducted
                  </Label.Root>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      ₹
                    </span>
                    <input
                      id={`withdrawals.${index}.tds`}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      {...register(`withdrawals.${index}.tds`, { valueAsNumber: true })}
                      className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        entryErrors?.tds ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {entryErrors?.tds && (
                    <p className="mt-1 text-sm text-red-600">{entryErrors.tds.message}</p>
                  )}
                </div>

                {/* Per-entry Capital Gains Summary */}
                {(Number(w?.amountWithdrawn) || 0) > 0 && w?.dateOfInvestment && (
                  <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">Capital Gain</span>
                      <span
                        className={`font-semibold ${
                          capitalGain >= 0 ? 'text-blue-900' : 'text-red-600'
                        }`}
                      >
                        {formatINR(capitalGain)}{' '}
                        <span
                          className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            classification.type === 'LTCG'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {classification.type}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Withdrawal Button */}
      <button
        type="button"
        onClick={() => append(createEmptyWithdrawal())}
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
        Add Withdrawal
      </button>

      {errors.withdrawals?.root && (
        <p className="text-sm text-red-600">{errors.withdrawals.root.message}</p>
      )}

      {/* Aggregate Summary */}
      {watchedWithdrawals?.length > 0 &&
        watchedWithdrawals.some(w => (Number(w.amountWithdrawn) || 0) > 0) && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-900">
              Aggregate Summary ({watchedWithdrawals.length} withdrawal
              {watchedWithdrawals.length !== 1 ? 's' : ''})
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-blue-700">Total Withdrawals</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(aggregateSummary.totalWithdrawals)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-blue-700">Total Cost of Acquisition</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(aggregateSummary.totalCost)}
                </dd>
              </div>
              {aggregateSummary.totalLtcg !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-blue-700">Long-Term Capital Gains</dt>
                  <dd
                    className={`font-medium ${
                      aggregateSummary.totalLtcg >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {formatINR(aggregateSummary.totalLtcg)}
                  </dd>
                </div>
              )}
              {aggregateSummary.totalStcg !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-blue-700">Short-Term Capital Gains</dt>
                  <dd
                    className={`font-medium ${
                      aggregateSummary.totalStcg >= 0 ? 'text-amber-700' : 'text-red-600'
                    }`}
                  >
                    {formatINR(aggregateSummary.totalStcg)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-blue-200 pt-1">
                <dt className="text-blue-700">Total TDS</dt>
                <dd className="font-medium text-blue-900">
                  {formatINR(aggregateSummary.totalTds)}
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
        id="hasMfWithdrawals"
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
      <Label.Root htmlFor="hasMfWithdrawals" className="cursor-pointer text-sm text-gray-700">
        I had mutual fund withdrawals during FY 2025-26
      </Label.Root>
    </div>
  );
}