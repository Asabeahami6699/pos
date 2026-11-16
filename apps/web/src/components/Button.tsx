import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) => {
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  };

  // Base classes with modern styling
  const baseClasses = 'inline-flex items-center justify-center font-medium focus:outline-none transition-all duration-300 ease-out';

  // Modern variant classes with gradients and better hover effects
  const variantClasses: Record<ButtonVariant, string> = {
    primary: `
      bg-gradient-to-r from-indigo-500/100 to-purple-500/50 
      text-white 
      shadow-sm 
      hover:shadow-md 
      hover:from-indigo-600 
      hover:to-purple-600 
      active:scale-[0.98]
      focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-2
      border-transparent
    `,
    secondary: `
      bg-secondary text-secondary-foreground
      border border-border
      shadow-sm
      hover:bg-muted
      active:scale-[0.98]
      focus:ring-2 focus:ring-ring/20 focus:ring-offset-2 focus:ring-offset-background
    `,
    danger: `
      bg-gradient-to-r from-red-500/100 to-pink-500 
      text-white 
      shadow-sm 
      hover:shadow-md 
      hover:from-red-600 
      hover:to-pink-600
      active:scale-[0.98]
      focus:ring-2 focus:ring-red-500/20 focus:ring-offset-2
      border-transparent
    `,
    ghost: `
      text-muted-foreground
      bg-transparent
      hover:bg-secondary
      hover:text-foreground
      active:bg-muted
      focus:ring-2 focus:ring-ring/20 focus:ring-offset-2 focus:ring-offset-background
      border-transparent
    `,
    outline: `
      text-primary
      bg-transparent
      border border-border
      hover:bg-secondary
      active:bg-muted
      focus:ring-2 focus:ring-ring/20 focus:ring-offset-2 focus:ring-offset-background
    `,
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = (disabled || loading) ? 'opacity-60 cursor-not-allowed hover:transform-none active:transform-none' : '';

  return (
    <button
      className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${widthClass}
        ${disabledClass}
        ${className}
        disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:transform-none
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

// Optional: Icon Button variant
interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: React.ReactNode;
  label?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = 'md',
  ...props
}) => {
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-2.5',
    lg: 'p-3',
  };

  return (
    <Button
      size={size}
      className={`!p-0 ${sizeClasses[size]} aspect-square`}
      {...props}
    >
      <span className="flex items-center justify-center">
        {icon}
        {label && <span className="sr-only">{label}</span>}
      </span>
    </Button>
  );
};

// Optional: Button Group component
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className = '' }) => {
  return (
    <div className={`inline-flex rounded-xl shadow-sm overflow-hidden border border-border ${className}`}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            className: `rounded-none border-none shadow-none ${
              index === 0 ? 'rounded-l-xl' : ''
            } ${
              index === React.Children.count(children) - 1 ? 'rounded-r-xl' : ''
            } ${
              index > 0 ? 'border-l border-border' : ''
            } ${child.props.className || ''}`,
          });
        }
        return child;
      })}
    </div>
  );
};

export default Button;