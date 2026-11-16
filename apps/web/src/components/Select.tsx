import React from 'react';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  /** Label text for the select field */
  label?: string;
  /** Current value of the select field */
  value: string;
  /** Callback function when value changes */
  onChange: (value: string) => void;
  /** Array of options to display */
  options: Option[];
  /** Whether the field is required */
  required?: boolean;
  /** Placeholder text when no option is selected */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Error state */
  error?: string;
  /** Help text */
  helpText?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  required = false,
  placeholder,
  disabled = false,
  className = '',
  error,
  helpText,
}) => {
  // Generate a unique ID for accessibility
  const id = React.useId();
  
  // Handle empty options array
  const safeOptions = options || [];
  
  // Determine placeholder text
  const placeholderText = placeholder || (label ? `Select ${label.toLowerCase()}` : 'Select an option');

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Label */}
      {label && (
        <label 
          htmlFor={id}
          className={`mb-1 text-sm font-medium ${
            error ? 'text-destructive' : 'text-foreground'
          }`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Select element */}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled || safeOptions.length === 0}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm text-sm
          focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50
          transition-colors duration-200 bg-secondary text-foreground
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          ${error ? 'border-destructive focus:border-destructive' : 'border-border'}
        `}
      >
        {/* Placeholder option */}
        <option value="" disabled className="text-muted-foreground">
          {placeholderText}
        </option>

        {/* Options list */}
        {safeOptions.length > 0 ? (
          safeOptions.map((opt) => (
            <option 
              key={opt.value} 
              value={opt.value}
              disabled={opt.disabled}
              className={opt.disabled ? 'text-muted-foreground' : ''}
            >
              {opt.label}
            </option>
          ))
        ) : (
          <option value="" disabled className="text-muted-foreground">
            No options available
          </option>
        )}
      </select>

      {/* Help text and error messages */}
      <div className="mt-1 min-h-[20px]">
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {!error && helpText && (
          <p className="text-sm text-muted-foreground">{helpText}</p>
        )}
      </div>
    </div>
  );
};

// Optional: Size variants
Select.defaultProps = {
  placeholder: '',
  disabled: false,
  className: '',
  required: false,
};

// Optional: Size variant extension
export const SelectWithSize: React.FC<SelectProps & { size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
  ...props
}) => {
  const sizeClasses = {
    sm: 'py-1 text-xs',
    md: 'py-2 text-sm',
    lg: 'py-3 text-base',
  };

  return (
    <Select
      {...props}
      className={`${props.className} ${sizeClasses[size]}`}
    />
  );
};