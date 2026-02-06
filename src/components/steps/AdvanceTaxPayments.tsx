import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Label from '@radix-ui/react-label';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';
import { useMemo } from 'react';
import { generateWorksheet } from '../../lib/calculator';

const advanceTaxSchema = z.object({
  juneAmount: z.number().min(0, 'Cannot be negative'),
  juneDate: z.string(),
  septemberAmount: z.number().min(0, 'Cannot be negative'),
  septemberDate: z.string(),
  decemberAmount: z.number().min(0, 'Cannot be negative'),
  decemberDate: z.string(),
  marchAmount: z.number().min(0, 'Cannot be negative'),
  marchDate: z.string(),
});

type AdvanceTaxForm = z.infer<typeof advanceTaxSchema>;

const QUARTERS = [
  { key: 'june', label: '1st Installment (By June 15)', dueDate: '2025-06-15' },
  { key: 'september', label: '2nd Installment (By Sept 15)', dueDate: '2025-09-15' },
  { key: 'december', label: '3rd Installment (By Dec 15)', dueDate: '2025-12-15' },
  { key: 'march', label: '4th Installment (By March 15)', dueDate: '2026-03-15' },
] as const;

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export function AdvanceTaxPayments() {
  const advanceTaxPaid = useTaxStore(s => s.advanceTaxPaid);
  const setAdvanceTaxPaid = useTaxStore(s => s.setAdvanceTaxPaid);
  const setCalculationResults = useTaxStore(s => s.setCalculationResults);
  const nextStep = useTaxStore(s => s.nextStep);

  const defaultValues = useMemo(() => {
    const vals: Record<string, string | number> = {
      juneAmount: 0, juneDate: '',
      septemberAmount: 0, septemberDate: '',
      decemberAmount: 0, decemberDate: '',
      marchAmount: 0, marchDate: '',
    };
    advanceTaxPaid.forEach(p => {
      vals[`${p.quarter}Amount`] = p.amountPaid;
      vals[`${p.quarter}Date`] = p.datePaid;
    });
    return vals as AdvanceTaxForm;
  }, [advanceTaxPaid]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AdvanceTaxForm>({
    resolver: zodResolver(advanceTaxSchema),
    defaultValues,
  });

  const watchedValues = watch();

  const totalPaid = useMemo(() => {
    return (
      (Number(watchedValues.juneAmount) || 0) +
      (Number(watchedValues.septemberAmount) || 0) +
      (Number(watchedValues.decemberAmount) || 0) +
      (Number(watchedValues.marchAmount) || 0)
    );
  }, [watchedValues]);

  const onSubmit = (data: AdvanceTaxForm) => {
    const payments = QUARTERS.map(q => ({
      quarter: q.key,
      dueDate: q.dueDate,
      amountPaid: Number(data[`${q.key}Amount` as keyof AdvanceTaxForm]) || 0,
      datePaid: data[`${q.key}Date` as keyof AdvanceTaxForm] as string,
    }));
    
    setAdvanceTaxPaid(payments);
    
    // In a real app, this would trigger the final calculation
    // Since we are at the last step, we can generate results
    const state = useTaxStore.getState();
    const results = generateWorksheet({ ...state, advanceTaxPaid: payments });
    setCalculationResults(results);
    
    nextStep();
  };

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Advance Tax Payments</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter any advance tax installments you have already paid for FY 2025-26
        </p>
      </div>

      <div className="space-y-6">
        {QUARTERS.map(q => (
          <div key={q.key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">{q.label}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label.Root
                  htmlFor={`${q.key}Amount`}
                  className="text-xs font-medium text-gray-500"
                >
                  Amount Paid
                </Label.Root>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    ₹
                  </span>
                  <input
                    id={`${q.key}Amount`}
                    type="number"
                    step="0.01"
                    placeholder="0"
                    {...register(`${q.key}Amount` as keyof AdvanceTaxForm, { valueAsNumber: true })}
                    className={`block w-full rounded-md border py-2 pl-7 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors[`${q.key}Amount` as keyof AdvanceTaxForm]
                        ? 'border-red-400 focus:ring-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>
              <div>
                <Label.Root htmlFor={`${q.key}Date`} className="text-xs font-medium text-gray-500">
                  Payment Date
                </Label.Root>
                <input
                  id={`${q.key}Date`}
                  type="date"
                  {...register(`${q.key}Date` as keyof AdvanceTaxForm)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPaid > 0 && (
        <div className="rounded-md border border-green-100 bg-green-50 px-4 py-3">
          <div className="flex justify-between text-sm font-medium text-green-900">
            <span>Total Advance Tax Paid</span>
            <span>{formatINR(totalPaid)}</span>
          </div>
        </div>
      )}
    </form>
  );
}