import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-slate-900 hover:bg-accent-strong',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100',
  ghost: 'text-slate-900 hover:bg-slate-100',
  danger: 'bg-danger text-white hover:bg-red-800',
};

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Spinner /> : null}
      <span>{children}</span>
    </button>
  );
}

type ButtonLinkProps = {
  to: string;
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({
  to,
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </Link>
  );
}
