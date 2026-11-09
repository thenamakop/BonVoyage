import type { HTMLAttributes, ReactNode } from 'react';

/** The sticker card. `as` keeps a caller's own landmark (an article, a day section). */
export function Card({
  as: Tag = 'section',
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div' | 'details';
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      {...rest}
      className={`rounded-3xl border-[2.5px] border-ink bg-white p-6 shadow-sticker ${className}`}
    >
      {children}
    </Tag>
  );
}
