import React from 'react';
import { Button } from '../Button';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string | React.ReactNode;
  actionButton?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Optional data-tour attribute on the primary action */
  actionTourId?: string;
  secondaryAction?: React.ReactNode;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  actionButton,
  actionTourId,
  secondaryAction,
}) => {
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <div className="text-sm text-muted-foreground max-w-2xl">
              {typeof subtitle === 'string' ? <p>{subtitle}</p> : subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {secondaryAction}
          {actionButton && (
            <Button
              onClick={actionButton.onClick}
              size="sm"
              className="flex items-center gap-2"
              data-tour={actionTourId}
            >
              {actionButton.icon && <span>{actionButton.icon}</span>}
              <span>{actionButton.label}</span>
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4 h-px bg-gradient-to-r from-border via-border/60 to-transparent" />
    </div>
  );
};
