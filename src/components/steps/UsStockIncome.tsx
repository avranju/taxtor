import { useForm, useFieldArray } from 'react-hook-form';
import type { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Label from '@radix-ui/react-label';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';
import { useState, useMemo, useEffect, useRef } from 'react';
import { differenceInMonths, parseISO, format } from 'date-fns';
import { useForexRate } from '../../hooks/useForexRate';

const US_STOCK_LTCG_THRESHOLD_MONTHS = 24;

const saleSchema = z
  .object({
    id: z.string(),
    stockName: z.string(),
    dateOfPurchase: z.string().min(1, 'Date of purchase is required'),
    dateOfSale: z.string().min(1, 'Date of sale is required'),
    saleProceedsUSD: z.number().min(0, 'Cannot be negative'),
    saleProceedsINR: z.number().min(1, 'Sale proceeds in INR is required'),
    costBasisUSD: z.number().min(0, 'Cannot be negative'),
    costBasisINR: z.number().min(0, 'Cannot be negative'),
    brokerageCharges: z.number().min(0, 'Cannot be negative'),
    tds: z.number().min(0, 'Cannot be negative'),
  })
  .refine(
    data => {
      if (!data.dateOfPurchase || !data.dateOfSale) return true;
      return parseISO(data.dateOfSale) > parseISO(data.dateOfPurchase);
    },
    {
      message: 'Date of sale must be after date of purchase',
      path: ['dateOfSale'],
    }
  )
  .refine(data => data.tds <= data.saleProceedsINR, {
    message: 'TDS cannot exceed sale proceeds',
    path: ['tds'],
  });

const formSchema = z.object({
  sales: z.array(saleSchema).min(1, 'Add at least one stock sale'),
});

type FormValues = z.infer<typeof formSchema>;

function computeHoldingMonths(dateOfPurchase: string, dateOfSale: string): number {
  if (!dateOfPurchase || !dateOfSale) return 0;
  const months = differenceInMonths(parseISO(dateOfSale), parseISO(dateOfPurchase));
  return Math.max(months, 0);
}

function getGainsClassification(holdingMonths: number): 'LTCG' | 'STCG' {
  return holdingMonths > US_STOCK_LTCG_THRESHOLD_MONTHS ? 'LTCG' : 'STCG';
}

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

function formatRateDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd-MMM-yyyy');
  } catch {
    return dateStr;
  }
}

function generateId() {
  return crypto.randomUUID();
}

function createEmptySale() {
  return {
    id: generateId(),
    stockName: '',
    dateOfPurchase: '',
    dateOfSale: '',
    saleProceedsUSD: 0,
    saleProceedsINR: 0,
    costBasisUSD: 0,
    costBasisINR: 0,
    brokerageCharges: 0,
    tds: 0,
  };
}

interface RateAnnotationProps {
  loading: boolean;
  error: string | null;
  rate: number | null;
  rateDate: string | null;
  isExactDate: boolean;
}

function RateAnnotation({ loading, error, rate, rateDate, isExactDate }: RateAnnotationProps) {
  if (loading) {
    return <p className="mt-1 text-xs text-gray-400">Loading exchange rate...</p>;
  }
  if (error) {
    return <p className="mt-1 text-xs text-amber-600">{error} — enter manually</p>;
  }
  if (rate && rateDate) {
    return (
      <p className="mt-1 text-xs text-gray-500">
        @ ₹{rate.toFixed(2)}/$ (SBI TT Buy, {formatRateDate(rateDate)})
        {!isExactDate && <span className="ml-1 text-gray-400">(nearest business day)</span>}
      </p>
    );
  }
  return null;
}

interface SaleEntryCardProps {
  index: number;
  fieldId: string;
  watchedSale: FormValues['sales'][number] | undefined;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  errors: FieldErrors<FormValues>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRemove: () => void;
  canRemove: boolean;
}

function SaleEntryCard({
  index,
  fieldId,
  watchedSale,
  register,
  setValue,
  errors,
  isCollapsed,
  onToggleCollapse,
  onRemove,
  canRemove,
}: SaleEntryCardProps) {
  const s = watchedSale;
  const holdingMonths = s ? computeHoldingMonths(s.dateOfPurchase, s.dateOfSale) : 0;
  const classification = s ? getGainsClassification(holdingMonths) : 'STCG';
  const capitalGain =
    (Number(s?.saleProceedsINR) || 0) -
    (Number(s?.costBasisINR) || 0) -
    (Number(s?.brokerageCharges) || 0);
  const entryErrors = errors.sales?.[index];

  // Forex rate hooks — one for sale date, one for purchase date
  const saleRate = useForexRate(s?.dateOfSale || undefined);
  const purchaseRate = useForexRate(s?.dateOfPurchase || undefined);

  // Track last auto-computed values to detect manual overrides
  const lastAutoSaleProceedsINR = useRef<number | null>(null);
  const lastAutoCostBasisINR = useRef<number | null>(null);

  // Auto-convert sale proceeds USD → INR
  const saleProceedsUSD = Number(s?.saleProceedsUSD) || 0;
  const currentSaleProceedsINR = Number(s?.saleProceedsINR) || 0;

  useEffect(() => {
    if (!saleRate.rate || saleProceedsUSD === 0) return;
    const computed = Math.round(saleProceedsUSD * saleRate.rate);
    // Only auto-fill if field is 0 or still matches our last auto-computed value
    if (
      currentSaleProceedsINR === 0 ||
      currentSaleProceedsINR === lastAutoSaleProceedsINR.current
    ) {
      setValue(`sales.${index}.saleProceedsINR`, computed, {
        shouldValidate: true,
      });
      lastAutoSaleProceedsINR.current = computed;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleProceedsUSD, saleRate.rate]);

  // Auto-convert cost basis USD → INR
  const costBasisUSD = Number(s?.costBasisUSD) || 0;
  const currentCostBasisINR = Number(s?.costBasisINR) || 0;

  useEffect(() => {
    if (!purchaseRate.rate || costBasisUSD === 0) return;
    const computed = Math.round(costBasisUSD * purchaseRate.rate);
    if (currentCostBasisINR === 0 || currentCostBasisINR === lastAutoCostBasisINR.current) {
      setValue(`sales.${index}.costBasisINR`, computed, {
        shouldValidate: true,
      });
      lastAutoCostBasisINR.current = computed;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costBasisUSD, purchaseRate.rate]);

  return (
    <div key={fieldId} className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Card Header */}
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
            {index + 1}
          </span>
          <div className="text-sm">
            <span className="font-medium text-gray-900">
              {s?.stockName || `Sale #${index + 1}`}
            </span>
            {(Number(s?.saleProceedsINR) || 0) > 0 && (
              <span className="ml-2 text-gray-500">
                {formatINR(Number(s?.saleProceedsINR) || 0)}
              </span>
            )}
            {s?.dateOfPurchase && s?.dateOfSale && (
              <span
                className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  classification === 'LTCG'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {classification}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canRemove && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onRemove();
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
          <input type="hidden" {...register(`sales.${index}.id`)} />

          {/* Stock Name */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.stockName`}
              className="text-sm font-medium text-gray-700"
            >
              Stock Name
            </Label.Root>
            <input
              id={`sales.${index}.stockName`}
              type="text"
              placeholder="e.g. AAPL, GOOGL"
              {...register(`sales.${index}.stockName`)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date of Purchase */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.dateOfPurchase`}
              className="text-sm font-medium text-gray-700"
            >
              Date of Purchase <span className="text-red-500">*</span>
            </Label.Root>
            <input
              id={`sales.${index}.dateOfPurchase`}
              type="date"
              {...register(`sales.${index}.dateOfPurchase`)}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                entryErrors?.dateOfPurchase
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {entryErrors?.dateOfPurchase && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.dateOfPurchase.message}</p>
            )}
          </div>

          {/* Date of Sale */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.dateOfSale`}
              className="text-sm font-medium text-gray-700"
            >
              Date of Sale <span className="text-red-500">*</span>
            </Label.Root>
            <p className="mt-0.5 text-xs text-gray-400">
              Must be within FY 2025-26 (Apr 2025 - Mar 2026)
            </p>
            <input
              id={`sales.${index}.dateOfSale`}
              type="date"
              min="2025-04-01"
              max="2026-03-31"
              {...register(`sales.${index}.dateOfSale`)}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                entryErrors?.dateOfSale ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
              }`}
            />
            {entryErrors?.dateOfSale && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.dateOfSale.message}</p>
            )}
          </div>

          {/* Holding Period Badge */}
          {s?.dateOfPurchase && s?.dateOfSale && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                classification === 'LTCG'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {holdingMonths} month{holdingMonths !== 1 ? 's' : ''}
              <span className="ml-2 font-medium">&rarr; {classification}</span>
              <span className="ml-1 text-xs opacity-75">
                (threshold: &gt;{US_STOCK_LTCG_THRESHOLD_MONTHS} months for US stocks)
              </span>
            </div>
          )}

          {/* Sale Proceeds USD */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.saleProceedsUSD`}
              className="text-sm font-medium text-gray-700"
            >
              Sale Proceeds in USD <span className="text-red-500">*</span>
            </Label.Root>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                $
              </span>
              <input
                id={`sales.${index}.saleProceedsUSD`}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                {...register(`sales.${index}.saleProceedsUSD`, {
                  valueAsNumber: true,
                })}
                className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  entryErrors?.saleProceedsUSD
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-gray-300'
                }`}
              />
            </div>
            {entryErrors?.saleProceedsUSD && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.saleProceedsUSD.message}</p>
            )}
          </div>

          {/* Sale Proceeds INR */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.saleProceedsINR`}
              className="text-sm font-medium text-gray-700"
            >
              Sale Proceeds in INR <span className="text-red-500">*</span>
            </Label.Root>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                ₹
              </span>
              <input
                id={`sales.${index}.saleProceedsINR`}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                {...register(`sales.${index}.saleProceedsINR`, {
                  valueAsNumber: true,
                })}
                className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  entryErrors?.saleProceedsINR
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-gray-300'
                }`}
              />
            </div>
            <RateAnnotation
              loading={saleRate.loading}
              error={saleRate.error}
              rate={saleRate.rate}
              rateDate={saleRate.rateDate}
              isExactDate={saleRate.isExactDate}
            />
            {entryErrors?.saleProceedsINR && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.saleProceedsINR.message}</p>
            )}
          </div>

          {/* Cost Basis USD */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.costBasisUSD`}
              className="text-sm font-medium text-gray-700"
            >
              Cost of Acquisition in USD <span className="text-red-500">*</span>
            </Label.Root>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                $
              </span>
              <input
                id={`sales.${index}.costBasisUSD`}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                {...register(`sales.${index}.costBasisUSD`, {
                  valueAsNumber: true,
                })}
                className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  entryErrors?.costBasisUSD
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-gray-300'
                }`}
              />
            </div>
            {entryErrors?.costBasisUSD && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.costBasisUSD.message}</p>
            )}
          </div>

          {/* Cost Basis INR */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.costBasisINR`}
              className="text-sm font-medium text-gray-700"
            >
              Cost of Acquisition in INR <span className="text-red-500">*</span>
            </Label.Root>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                ₹
              </span>
              <input
                id={`sales.${index}.costBasisINR`}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                {...register(`sales.${index}.costBasisINR`, {
                  valueAsNumber: true,
                })}
                className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  entryErrors?.costBasisINR
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-gray-300'
                }`}
              />
            </div>
            <RateAnnotation
              loading={purchaseRate.loading}
              error={purchaseRate.error}
              rate={purchaseRate.rate}
              rateDate={purchaseRate.rateDate}
              isExactDate={purchaseRate.isExactDate}
            />
            {entryErrors?.costBasisINR && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.costBasisINR.message}</p>
            )}
          </div>

          {/* Brokerage & Charges */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.brokerageCharges`}
              className="text-sm font-medium text-gray-700"
            >
              Brokerage &amp; Charges
            </Label.Root>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                ₹
              </span>
              <input
                id={`sales.${index}.brokerageCharges`}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                {...register(`sales.${index}.brokerageCharges`, {
                  valueAsNumber: true,
                })}
                className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  entryErrors?.brokerageCharges
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-gray-300'
                }`}
              />
            </div>
            {entryErrors?.brokerageCharges && (
              <p className="mt-1 text-sm text-red-600">{entryErrors.brokerageCharges.message}</p>
            )}
          </div>

          {/* TDS */}
          <div>
            <Label.Root
              htmlFor={`sales.${index}.tds`}
              className="text-sm font-medium text-gray-700"
            >
              TDS Deducted
            </Label.Root>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                ₹
              </span>
              <input
                id={`sales.${index}.tds`}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                {...register(`sales.${index}.tds`, { valueAsNumber: true })}
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
          {(Number(s?.saleProceedsINR) || 0) > 0 && s?.dateOfPurchase && s?.dateOfSale && (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-blue-700">
                  <span>Sale Proceeds (INR)</span>
                  <span>{formatINR(Number(s.saleProceedsINR) || 0)}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span>Less: Cost of Acquisition</span>
                  <span>{formatINR(Number(s.costBasisINR) || 0)}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span>Less: Brokerage &amp; Charges</span>
                  <span>{formatINR(Number(s.brokerageCharges) || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-1">
                  <span className="font-medium text-blue-900">Capital Gain</span>
                  <span
                    className={`font-semibold ${
                      capitalGain >= 0 ? 'text-blue-900' : 'text-red-600'
                    }`}
                  >
                    {formatINR(capitalGain)}{' '}
                    <span
                      className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        classification === 'LTCG'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {classification}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function UsStockIncome() {
  const usStockSales = useTaxStore(s => s.usStockSales);
  const setUsStockSales = useTaxStore(s => s.setUsStockSales);
  const nextStep = useTaxStore(s => s.nextStep);

  const [hasUsStockSales, setHasUsStockSales] = useState(usStockSales.length > 0);
  const [collapsedEntries, setCollapsedEntries] = useState<Set<number>>(new Set());

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
      sales:
        usStockSales.length > 0
          ? usStockSales.map(s => ({
              id: s.id,
              stockName: s.stockName,
              dateOfPurchase: s.dateOfPurchase,
              dateOfSale: s.dateOfSale,
              saleProceedsUSD: s.saleProceedsUSD,
              saleProceedsINR: s.saleProceedsINR,
              costBasisUSD: s.costBasisUSD,
              costBasisINR: s.costBasisINR,
              brokerageCharges: s.brokerageCharges,
              tds: s.tds,
            }))
          : [createEmptySale()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'sales',
  });

  const watchedSales = watch('sales');

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
    let totalSaleProceeds = 0;
    let totalCost = 0;
    let totalBrokerage = 0;
    let totalLtcg = 0;
    let totalStcg = 0;
    let totalTds = 0;

    for (const s of watchedSales || []) {
      const proceeds = Number(s.saleProceedsINR) || 0;
      const cost = Number(s.costBasisINR) || 0;
      const brokerage = Number(s.brokerageCharges) || 0;
      const tds = Number(s.tds) || 0;
      const gain = proceeds - cost - brokerage;
      const holdingMonths = computeHoldingMonths(s.dateOfPurchase, s.dateOfSale);
      const classification = getGainsClassification(holdingMonths);

      totalSaleProceeds += proceeds;
      totalCost += cost;
      totalBrokerage += brokerage;
      totalTds += tds;

      if (classification === 'LTCG') {
        totalLtcg += gain;
      } else {
        totalStcg += gain;
      }
    }

    return {
      totalSaleProceeds,
      totalCost,
      totalBrokerage,
      totalLtcg,
      totalStcg,
      totalTds,
    };
  }, [
    watchedSales,
    watchedSales
      ?.map(
        s =>
          `${s.saleProceedsINR}-${s.costBasisINR}-${s.brokerageCharges}-${s.tds}-${s.dateOfPurchase}-${s.dateOfSale}`
      )
      .join(','),
  ]);

  const onSubmit = (data: FormValues) => {
    const entries = data.sales.map(s => ({
      id: s.id,
      stockName: s.stockName,
      dateOfPurchase: s.dateOfPurchase,
      dateOfSale: s.dateOfSale,
      saleProceedsUSD: s.saleProceedsUSD,
      saleProceedsINR: s.saleProceedsINR,
      costBasisUSD: s.costBasisUSD,
      costBasisINR: s.costBasisINR,
      brokerageCharges: s.brokerageCharges,
      holdingPeriodMonths: computeHoldingMonths(s.dateOfPurchase, s.dateOfSale),
      tds: s.tds,
    }));
    setUsStockSales(entries);
    nextStep();
  };

  const onSkip = () => {
    setUsStockSales([]);
    nextStep();
  };

  if (!hasUsStockSales) {
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
          <h2 className="text-xl font-semibold text-gray-900">US Stock Income</h2>
          <p className="mt-1 text-sm text-gray-500">
            Capital gains from sale of US stocks during FY 2025-26
          </p>
        </div>

        <SkipCheckbox checked={hasUsStockSales} onChange={setHasUsStockSales} />

        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          No US stock sales to report. Click <strong>Next</strong> to continue.
        </div>
      </form>
    );
  }

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">US Stock Income</h2>
        <p className="mt-1 text-sm text-gray-500">
          Capital gains from sale of US stocks during FY 2025-26
        </p>
      </div>

      <SkipCheckbox checked={hasUsStockSales} onChange={setHasUsStockSales} />

      {fields.map((field, index) => (
        <SaleEntryCard
          key={field.id}
          index={index}
          fieldId={field.id}
          watchedSale={watchedSales?.[index]}
          register={register}
          setValue={setValue}
          errors={errors}
          isCollapsed={collapsedEntries.has(index)}
          onToggleCollapse={() => toggleCollapse(index)}
          onRemove={() => {
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
          canRemove={fields.length > 1}
        />
      ))}

      {/* Add Sale Button */}
      <button
        type="button"
        onClick={() => append(createEmptySale())}
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
        Add Sale
      </button>

      {errors.sales?.root && <p className="text-sm text-red-600">{errors.sales.root.message}</p>}

      {/* Aggregate Summary */}
      {watchedSales?.length > 0 && watchedSales.some(s => (Number(s.saleProceedsINR) || 0) > 0) && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-900">
            Aggregate Summary ({watchedSales.length} sale
            {watchedSales.length !== 1 ? 's' : ''})
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-blue-700">Total Sale Proceeds (INR)</dt>
              <dd className="font-medium text-blue-900">
                {formatINR(aggregateSummary.totalSaleProceeds)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-blue-700">Total Cost of Acquisition (INR)</dt>
              <dd className="font-medium text-blue-900">{formatINR(aggregateSummary.totalCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-blue-700">Total Brokerage &amp; Charges</dt>
              <dd className="font-medium text-blue-900">
                {formatINR(aggregateSummary.totalBrokerage)}
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
        id="hasUsStockSales"
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
      <Label.Root htmlFor="hasUsStockSales" className="cursor-pointer text-sm text-gray-700">
        I had US stock sales during FY 2025-26
      </Label.Root>
    </div>
  );
}
