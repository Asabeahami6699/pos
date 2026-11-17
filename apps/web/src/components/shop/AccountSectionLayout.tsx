import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface AccountSectionLayoutProps {
  title: string;
  subtitle?: string;
  /** @deprecated Always wide now — kept for call-site compatibility */
  wide?: boolean;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const AccountSectionLayout: React.FC<AccountSectionLayoutProps> = ({
  title,
  subtitle,
  backTo = '/account',
  backLabel = 'Back to account',
  actions,
  children,
}) => (
  <div className="account-shell w-full min-h-full flex flex-col">
    <header className="account-safe-header shrink-0">
      <div className="account-safe-pad" aria-hidden />
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {backTo ? (
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
    </header>

    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
      {children}
    </div>
  </div>
);
