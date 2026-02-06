import { useTaxStore } from '../../store/tax-store';

export function ProgressBar() {
  const currentStep = useTaxStore((s) => s.currentStep);
  const highestStepReached = useTaxStore((s) => s.highestStepReached);
  const stepLabels = useTaxStore((s) => s.stepLabels);
  const goToStep = useTaxStore((s) => s.goToStep);

  return (
    <nav className="mb-8">
      <ol className="flex items-center gap-2">
        {stepLabels.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isReachable = index <= highestStepReached && !isCurrent;

          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => goToStep(index)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isCurrent
                      ? 'bg-blue-600 text-white'
                      : index <= highestStepReached
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                } ${isReachable ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-2' : ''}`}
                title={isReachable ? `Go to ${label}` : undefined}
              >
                {index + 1}
              </button>
              <span
                className={`hidden text-sm md:inline ${
                  isCurrent
                    ? 'font-semibold text-gray-900'
                    : isReachable
                      ? 'cursor-pointer text-gray-700 hover:text-blue-600'
                      : 'text-gray-500'
                }`}
                onClick={isReachable ? () => goToStep(index) : undefined}
              >
                {label}
              </span>
              {index < stepLabels.length - 1 && (
                <div
                  className={`h-0.5 w-6 ${
                    index < highestStepReached ? 'bg-green-600' : 'bg-gray-200'
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
