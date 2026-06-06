// ---------------------------------------------------------------------------
// ToggleSwitch — premium physical-style ON/OFF pill.
//
// Visuals: 150×48 pill track with a 42×42 circular knob rendered via
// `::before`. Track gradient + inner shadow simulate a depressed metal
// button. Text "ON"/"OFF" is centered on the track while the knob
// slides to the opposite side. See `.toggle-switch` in `src/index.css`
// for the on/off gradients, knob positioning and focus ring.
// ---------------------------------------------------------------------------

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
  /** Text shown on the track when checked. */
  onText?: string;
  /** Text shown on the track when unchecked. */
  offText?: string;
  /** Optional class for the wrapper (e.g. margin). */
  className?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  onText = 'ON',
  offText = 'OFF',
  className = '',
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`toggle-switch ${checked ? 'on' : 'off'} ${className}`}
    >
      <span className="toggle-switch__text">{checked ? onText : offText}</span>
    </button>
  );
}
