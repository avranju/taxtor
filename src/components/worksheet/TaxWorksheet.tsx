import { useTaxStore } from '../../store/tax-store';
import { useMemo } from 'react';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export function TaxWorksheet() {
  const calculationResults = useTaxStore(s => s.calculationResults);
  const salaryIncome = useTaxStore(s => s.salaryIncome);
  const otherIncome = useTaxStore(s => s.otherIncome);
  const personalInfo = useTaxStore(s => s.personalInfo);

  const totalOtherIncome = useMemo(() => 
    otherIncome.reduce((acc, curr) => acc + curr.amount, 0), 
    [otherIncome]
  );

  if (!calculationResults) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
        <p className="text-gray-500">No calculation results available. Please complete the wizard.</p>
      </div>
    );
  }

  const {
    totalIncome,
    taxableIncome,
    taxOldRegime,
    taxNewRegime,
    recommendedRegime,
    advanceTaxSchedule,
    interest234B,
    interest234C,
    totalTdsCredited,
    netAmountPayable,
  } = calculationResults;

  const finalTax = recommendedRegime === 'old' ? taxOldRegime : taxNewRegime;

  return (
    <div className="space-y-8 print:space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tax Computation Worksheet</h2>
          <p className="text-sm text-gray-500">
            Assessment Year: 2026-27 | PAN: <span className="font-mono">{personalInfo.pan}</span>
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 print:hidden"
        >
          Print PDF
        </button>
      </div>

      {/* Section A: Income Summary */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 border-l-4 border-blue-500 pl-2">
          Section A: Income Summary
        </h3>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {salaryIncome && (
                <tr>
                  <td className="px-4 py-2 text-gray-600">Income from Salary (Net)</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatINR(salaryIncome.grossSalary - salaryIncome.professionalTax - salaryIncome.standardDeduction)}
                  </td>
                </tr>
              )}
              {totalOtherIncome > 0 && (
                <tr>
                  <td className="px-4 py-2 text-gray-600">Income from Other Sources</td>
                  <td className="px-4 py-2 text-right font-medium">{formatINR(totalOtherIncome)}</td>
                </tr>
              )}
              <tr className="bg-gray-50">
                <td className="px-4 py-2 font-semibold text-gray-900">Gross Total Income</td>
                <td className="px-4 py-2 text-right font-bold">{formatINR(totalIncome)}</td>
              </tr>
              {recommendedRegime === 'old' && (
                <tr>
                  <td className="px-4 py-2 text-gray-600">Total Deductions (Chapter VI-A)</td>
                  <td className="px-4 py-2 text-right font-medium text-red-600">
                    - {formatINR(totalIncome - taxableIncome)}
                  </td>
                </tr>
              )}
              <tr className="bg-blue-50">
                <td className="px-4 py-2 font-semibold text-blue-900">Net Taxable Income</td>
                <td className="px-4 py-2 text-right font-bold text-blue-900">{formatINR(taxableIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section B: Tax Computation */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 border-l-4 border-green-500 pl-2">
          Section B: Tax Computation
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`rounded-lg border p-4 ${recommendedRegime === 'old' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200'}`}>
            <div className="flex justify-between">
              <span className="text-sm font-bold text-gray-900">Old Regime</span>
              {recommendedRegime === 'old' && (
                <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">Recommended</span>
              )}
            </div>
            <div className="mt-2 text-2xl font-bold">{formatINR(taxOldRegime)}</div>
            <p className="mt-1 text-xs text-gray-500">With Chapter VI-A Deductions</p>
          </div>
          <div className={`rounded-lg border p-4 ${recommendedRegime === 'new' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200'}`}>
            <div className="flex justify-between">
              <span className="text-sm font-bold text-gray-900">New Regime</span>
              {recommendedRegime === 'new' && (
                <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">Recommended</span>
              )}
            </div>
            <div className="mt-2 text-2xl font-bold">{formatINR(taxNewRegime)}</div>
            <p className="mt-1 text-xs text-gray-500">FY 2025-26 Default Rates</p>
          </div>
        </div>
      </section>

      {/* Section C: Advance Tax Schedule */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 border-l-4 border-amber-500 pl-2">
          Section C: Advance Tax Schedule
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Due Date</th>
                <th className="px-4 py-2 text-right">Required (Cum.)</th>
                <th className="px-4 py-2 text-right">Actual Paid</th>
                <th className="px-4 py-2 text-right">Shortfall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {advanceTaxSchedule.map((item) => (
                <tr key={item.quarter}>
                  <td className="px-4 py-2">
                    <span className="font-medium text-gray-900">{item.dueDate}</span>
                    <span className="ml-2 text-xs text-gray-400">({item.cumulativePercentage}%)</span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatINR(item.requiredAmount)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatINR(item.actualPaid)}</td>
                  <td className="px-4 py-2 text-right font-medium text-red-600">
                    {item.shortfall > 0 ? formatINR(item.shortfall) : 'Nil'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Summary Section */}
      <div className="rounded-xl border-2 border-blue-600 bg-blue-50 p-6 shadow-sm">
        <h3 className="mb-4 text-xl font-bold text-blue-900 uppercase tracking-tight">Final Settlement Today</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-blue-700">Total Tax Liability (after Cess/Surcharge)</dt>
            <dd className="font-semibold text-blue-900">{formatINR(finalTax)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-blue-700">Less: Total TDS Credit</dt>
            <dd className="font-semibold text-blue-900">- {formatINR(totalTdsCredited)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-blue-700">Less: Advance Tax Already Paid</dt>
            <dd className="font-semibold text-blue-900">
              - {formatINR(advanceTaxSchedule.reduce((acc, curr) => acc + curr.actualPaid, 0))}
            </dd>
          </div>
          {(interest234B > 0 || interest234C > 0) && (
            <div className="border-t border-blue-200 pt-3 space-y-2">
              {interest234B > 0 && (
                <div className="flex justify-between">
                  <dt className="text-red-700">Add: Interest u/s 234B (Shortfall in Advance Tax)</dt>
                  <dd className="font-semibold text-red-700">+ {formatINR(interest234B)}</dd>
                </div>
              )}
              {interest234C > 0 && (
                <div className="flex justify-between">
                  <dt className="text-red-700">Add: Interest u/s 234C (Deferment of Installments)</dt>
                  <dd className="font-semibold text-red-700">+ {formatINR(interest234C)}</dd>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between border-t-2 border-blue-300 pt-4">
            <dt className="text-lg font-bold text-blue-900">Net Self-Assessment Tax Payable</dt>
            <dd className="text-2xl font-black text-blue-900">{formatINR(netAmountPayable)}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-md bg-amber-50 p-4 ring-1 ring-inset ring-amber-200">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">Compliance Disclaimer</h3>
            <div className="mt-2 text-xs text-amber-700">
              <p>
                This calculator provides estimates based on information provided. Tax laws are complex and subject to
                interpretation. Always consult a qualified Chartered Accountant or tax professional before making tax payments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}