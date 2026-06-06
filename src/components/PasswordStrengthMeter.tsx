import { getPasswordStrength, type StrengthLabel } from '../services/authService';

interface PasswordStrengthMeterProps {
  password: string;
  /** Optional extra class for the wrapper (e.g. margin-top). */
  className?: string;
}

const BAR_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-gray-200',
  1: 'bg-critical',
  2: 'bg-pending',
  3: 'bg-amber-500',
  4: 'bg-success',
};

const TEXT_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'text-gray-400',
  1: 'text-critical',
  2: 'text-pending',
  3: 'text-amber-600',
  4: 'text-success',
};

const SCORE_LABEL: Record<0 | 1 | 2 | 3 | 4, StrengthLabel> = {
  0: 'Muito fraca',
  1: 'Fraca',
  2: 'Razoável',
  3: 'Forte',
  4: 'Muito forte',
};

export default function PasswordStrengthMeter({
  password,
  className = '',
}: PasswordStrengthMeterProps) {
  if (!password) return null;
  const { score } = getPasswordStrength(password);
  const segments = [0, 1, 2, 3, 4];

  return (
    <div className={`space-y-1.5 ${className}`} aria-live="polite">
      <div className="flex gap-1">
        {segments.map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= score ? BAR_COLORS[score as 0 | 1 | 2 | 3 | 4] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <div
        className={`text-[11px] font-bold uppercase tracking-wider ${
          TEXT_COLORS[score as 0 | 1 | 2 | 3 | 4]
        }`}
      >
        Força: {SCORE_LABEL[score as 0 | 1 | 2 | 3 | 4]}
      </div>
    </div>
  );
}
