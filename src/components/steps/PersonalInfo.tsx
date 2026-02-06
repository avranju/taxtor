import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Label from '@radix-ui/react-label';
import { useTaxStore } from '../../store/tax-store';
import { WIZARD_FORM_ID } from '../wizard/WizardShell';

const personalInfoSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  pan: z
    .string()
    .min(1, 'PAN is required')
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must be in format AAAAA1234A'),
  ageBracket: z.enum(['below60', '60to80', 'above80']),
  residentialStatus: z.enum(['resident', 'non-resident', 'rnor']),
  dateOfUnemployment: z.string().nullable(),
});

type PersonalInfoForm = z.infer<typeof personalInfoSchema>;

const AGE_BRACKETS = [
  { value: 'below60', label: 'Individual', description: 'Below 60 years' },
  { value: '60to80', label: 'Senior Citizen', description: '60 to 80 years' },
  { value: 'above80', label: 'Super Senior Citizen', description: 'Above 80 years' },
] as const;

const RESIDENTIAL_STATUSES = [
  { value: 'resident', label: 'Resident' },
  { value: 'non-resident', label: 'Non-Resident' },
  { value: 'rnor', label: 'RNOR', description: 'Resident but Not Ordinarily Resident' },
] as const;

export function PersonalInfo() {
  const personalInfo = useTaxStore((s) => s.personalInfo);
  const setPersonalInfo = useTaxStore((s) => s.setPersonalInfo);
  const nextStep = useTaxStore((s) => s.nextStep);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      name: personalInfo.name,
      pan: personalInfo.pan,
      ageBracket: personalInfo.ageBracket,
      residentialStatus: personalInfo.residentialStatus,
      dateOfUnemployment: personalInfo.dateOfUnemployment,
    },
  });

  const ageBracket = watch('ageBracket');
  const residentialStatus = watch('residentialStatus');

  const onSubmit = (data: PersonalInfoForm) => {
    setPersonalInfo({
      ...personalInfo,
      name: data.name,
      pan: data.pan,
      ageBracket: data.ageBracket,
      residentialStatus: data.residentialStatus,
      dateOfUnemployment: data.dateOfUnemployment || null,
    });
    nextStep();
  };

  return (
    <form id={WIZARD_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
        <p className="mt-1 text-sm text-gray-500">
          Basic details for your tax computation &mdash; FY 2025-26 (AY 2026-27)
        </p>
      </div>

      {/* Financial Year (read-only) */}
      <div>
        <Label.Root className="text-sm font-medium text-gray-700">
          Financial Year
        </Label.Root>
        <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          FY 2025-26 (AY 2026-27)
        </div>
      </div>

      {/* Name */}
      <div>
        <Label.Root htmlFor="name" className="text-sm font-medium text-gray-700">
          Full Name <span className="text-red-500">*</span>
        </Label.Root>
        <input
          id="name"
          type="text"
          placeholder="As per PAN card"
          {...register('name')}
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* PAN */}
      <div>
        <Label.Root htmlFor="pan" className="text-sm font-medium text-gray-700">
          PAN <span className="text-red-500">*</span>
        </Label.Root>
        <input
          id="pan"
          type="text"
          placeholder="AAAAA1234A"
          maxLength={10}
          {...register('pan', {
            onChange: (e) => {
              e.target.value = e.target.value.toUpperCase();
            },
          })}
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm font-mono uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.pan ? 'border-red-400 focus:ring-red-500' : 'border-gray-300'
          }`}
        />
        {errors.pan && (
          <p className="mt-1 text-sm text-red-600">{errors.pan.message}</p>
        )}
      </div>

      {/* Taxpayer Category (Age Bracket) */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">
          Taxpayer Category <span className="text-red-500">*</span>
        </legend>
        <RadioGroup.Root
          className="mt-2 space-y-2"
          value={ageBracket}
          onValueChange={(value) =>
            setValue('ageBracket', value as PersonalInfoForm['ageBracket'], {
              shouldValidate: true,
            })
          }
        >
          {AGE_BRACKETS.map((bracket) => (
            <div key={bracket.value} className="flex items-center gap-3">
              <RadioGroup.Item
                value={bracket.value}
                id={`age-${bracket.value}`}
                className="h-4 w-4 rounded-full border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <RadioGroup.Indicator className="flex items-center justify-center after:block after:h-1.5 after:w-1.5 after:rounded-full after:bg-white" />
              </RadioGroup.Item>
              <Label.Root
                htmlFor={`age-${bracket.value}`}
                className="cursor-pointer text-sm text-gray-700"
              >
                {bracket.label}{' '}
                <span className="text-gray-400">({bracket.description})</span>
              </Label.Root>
            </div>
          ))}
        </RadioGroup.Root>
      </fieldset>

      {/* Residential Status */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">
          Residential Status <span className="text-red-500">*</span>
        </legend>
        <RadioGroup.Root
          className="mt-2 space-y-2"
          value={residentialStatus}
          onValueChange={(value) =>
            setValue('residentialStatus', value as PersonalInfoForm['residentialStatus'], {
              shouldValidate: true,
            })
          }
        >
          {RESIDENTIAL_STATUSES.map((status) => (
            <div key={status.value} className="flex items-center gap-3">
              <RadioGroup.Item
                value={status.value}
                id={`res-${status.value}`}
                className="h-4 w-4 rounded-full border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <RadioGroup.Indicator className="flex items-center justify-center after:block after:h-1.5 after:w-1.5 after:rounded-full after:bg-white" />
              </RadioGroup.Item>
              <Label.Root
                htmlFor={`res-${status.value}`}
                className="cursor-pointer text-sm text-gray-700"
              >
                {status.label}
                {'description' in status && (
                  <span className="text-gray-400"> ({status.description})</span>
                )}
              </Label.Root>
            </div>
          ))}
        </RadioGroup.Root>
      </fieldset>

      {/* Date of Unemployment */}
      <div>
        <Label.Root htmlFor="dateOfUnemployment" className="text-sm font-medium text-gray-700">
          Date of Unemployment
        </Label.Root>
        <p className="mt-0.5 text-xs text-gray-400">
          If you became unemployed during FY 2025-26, enter the date. Leave blank if not applicable.
        </p>
        <input
          id="dateOfUnemployment"
          type="date"
          min="2025-04-01"
          max="2026-03-31"
          {...register('dateOfUnemployment')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </form>
  );
}
