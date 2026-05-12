import { Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button. Defaults to `'primary'`. */
  variant?: ButtonVariant;
  /** Size preset. Defaults to `'md'`. */
  size?: ButtonSize;
  /** When `true` a spinner replaces the leading icon and the button is disabled. */
  loading?: boolean;
  /** Stretch to fill the parent container width. */
  fullWidth?: boolean;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 ' +
    'focus:ring-primary-500 border-transparent',
  secondary:
    'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 ' +
    'focus:ring-gray-400',
  danger:
    'bg-error-600 text-white hover:bg-error-700 ' +
    'focus:ring-error-500 border-transparent',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3   text-base gap-2',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Reusable button with three variants (`primary`, `secondary`, `danger`),
 * three sizes, and a built-in loading state.
 *
 * @example
 * <Button variant="primary" loading={saving} onClick={handleSave}>
 *   Save
 * </Button>
 */
export function Button({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  type      = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center rounded-lg border font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
