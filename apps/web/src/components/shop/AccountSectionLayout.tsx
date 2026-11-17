import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface AccountSectionLayoutProps {
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: React.ReactNode;
}

export const AccountSectionLayout: React.FC<AccountSectionLayoutProps> = ({
  title,
  subtitle,
  wide = false,
  children,
}) => (
  <div className={`${wide ? 'max-w-5xl' : 'max-w-lg'} mx-auto space-y-4 px-3 sm:px-0`}>
    <Link
      to="/account"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to account
    </Link>
    <div>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);
