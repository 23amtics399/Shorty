import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, mono = false, className = '', id, ...props },
  ref,
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`input ${mono ? 'input-mono' : ''} ${className}`.trim()}
        style={error ? { borderColor: 'var(--color-danger)' } : undefined}
        {...props}
      />
      {error ? (
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-danger)' }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{hint}</span>
      ) : null}
    </div>
  );
});
