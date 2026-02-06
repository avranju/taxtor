import { useTaxStore } from '../../store/tax-store';

export function ProgressBar() {
  const currentStep = useTaxStore((s) => s.currentStep);
  const stepLabels = useTaxStore((s) => s.stepLabels);

  return (
    <nav className="mb-8">
      <ol className="flex items-center gap-2">
        {stepLabels.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`hidden text-sm md:inline ${
                  isCurrent ? 'font-semibold text-gray-900' : 'text-gray-500'
                }`}
              >
                {label}
              </span>
              {index < stepLabels.length - 1 && (
                <div
                  className={`h-0.5 w-6 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
