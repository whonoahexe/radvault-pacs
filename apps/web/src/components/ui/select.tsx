import type { OptionHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  onValueChange?: (value: string) => void;
}

export function Select({ className, onValueChange, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...props}
    />
  );
}

export function SelectItem({ children, ...props }: OptionHTMLAttributes<HTMLOptionElement>) {
  return <option {...props}>{children}</option>;
}
