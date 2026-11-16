import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onScanSubmit?: (value: string) => boolean | void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onScanSubmit,
  placeholder = 'Search for products by name, SKU or barcode…',
  inputRef,
  autoFocus = false,
  className = '',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !onScanSubmit) return;
    e.preventDefault();
    const code = value.trim();
    if (!code) return;
    onScanSubmit(code);
  };

  return (
    <div className={`relative flex-1 min-w-0 ${className}`} data-tour="pos-search">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        inputMode="search"
        className="block w-full pl-10 pr-10 py-3 border border-border rounded-2xl bg-card shadow-sm focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
        aria-label="Search or scan products"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
