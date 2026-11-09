import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold transition-[translate,box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-60';
// Sticker buttons lift on hover and press on click; a disabled one stays put.
const sticker =
  'border-[2.5px] border-ink shadow-sticker-button not-disabled:hover:-translate-x-0.5 not-disabled:hover:-translate-y-0.5 not-disabled:hover:shadow-sticker-lift not-disabled:active:translate-x-0.5 not-disabled:active:translate-y-0.5 not-disabled:active:shadow-sticker-press';
const variants: Record<Variant, string> = {
  primary: `${sticker} bg-accent text-ink`,
  secondary: `${sticker} bg-white text-ink`,
  ghost: 'text-ink not-disabled:hover:bg-ink/5',
  danger: 'border-[2.5px] border-danger bg-white text-danger not-disabled:hover:bg-red-50',
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
