import { AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the input. */
  label?: string;
  /** Red validation message shown below the input. */
  error?: string;
  /** Subtle helper text shown below the input when there is no error. */
  hint?: string;
  /** Trailing element rendered inside the input (icon, unit, etc.). */
  trailing?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Controlled text input with label, error, and hint text support.
 * Automatically links `<label>` and error message to the `<input>` via
 * `htmlFor` / `aria-describedby` so screen readers announce them correctly.
 *
 * @example
 * <Input
 *   label="Email"
 *   type="email"
 *   value={email}
 *   onChange={e => setEmail(e.target.value)}
 *   error={errors.email}
 *   required
 * />
 */
export function Input({
  label,
  error,
  hint,
  trailing,
  id,
  className = '',
  ...rest
}: InputProps) {
  // Derive a stable id from the label when none is provided.
  const inputId = id ?? `input-${(label ?? 'field').toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  const hintId  = `${inputId}-hint`;

  const describedBy = [
    error ? errorId : null,
    hint && !error ? hintId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          {label}
          {rest.required && (
            <span className="text-error-600 ml-1" aria-hidden="true">*</span>
          )}
        </label>
      )}

      {/* Input wrapper (allows trailing element) */}
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={[
            'w-full px-4 py-2.5 rounded-lg border text-sm text-gray-900',
            'placeholder:text-gray-400 outline-none transition-colors',
            'focus:ring-2 focus:ring-primary-600 focus:border-primary-600',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
            trailing ? 'pr-10' : '',
            error
              ? 'border-error-400 bg-error-50 focus:ring-error-500 focus:border-error-500'
              : 'border-gray-300 hover:border-gray-400 bg-white',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-secondary-400">
            {trailing}
          </div>
        )}
      </div>

      {/* Hint text */}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-secondary-500">
          {hint}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-xs text-error-600 flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
