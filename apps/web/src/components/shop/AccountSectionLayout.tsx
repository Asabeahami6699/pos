import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface AccountSectionLayoutProps {
  title: string;
  children: React.ReactNode;
}

export const AccountSectionLayout: React.FC<AccountSectionLayoutProps> = ({ title, children }) => (
  <div className="max-w-lg mx-auto space-y-4">
    <Link
      to="/account"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to account
    </Link>
    <h1 className="text-xl font-bold text-foreground">{title}</h1>
    {children}
  </div>
);
