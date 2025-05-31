import React, { forwardRef } from 'react';

const Textarea = forwardRef(({ 
  className = '',
  placeholder,
  value,
  onChange,
  disabled = false,
  rows = 5,
  ...props 
}, ref) => {
  return (
    <textarea
      ref={ref}
      className={`flex min-h-[80px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      rows={rows}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;