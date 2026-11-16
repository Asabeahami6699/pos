import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: 'indigo' | 'blue' | 'green' | 'orange' | 'purple';
  trend?: string;
  onClick?: () => void;
  clickable?: boolean;
}

const colorClasses = {
  indigo: 'bg-primary/10 text-primary',
  blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  orange: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  trend,
  onClick,
  clickable,
}) => {
  const Wrapper = clickable ? 'button' : 'div';

  return (
    <Wrapper
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-xl border border-border/80 bg-card/80 backdrop-blur-sm p-4 text-left w-full min-w-0 transition-all duration-200 shadow-sm ${
        clickable ? 'hover:border-primary/40 hover:shadow-md cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
            {title}
          </p>
          <p
            className="text-xl font-bold text-foreground mt-1.5 truncate tabular-nums tracking-tight"
            title={String(value)}
          >
            {value}
          </p>
          {trend && (
            <p className="text-[11px] text-muted-foreground font-medium mt-2 line-clamp-2 leading-snug">
              {trend}
            </p>
          )}
        </div>
        <div
          className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${colorClasses[color]}`}
        >
          <span className="text-lg">{icon}</span>
        </div>
      </div>
    </Wrapper>
  );
};
