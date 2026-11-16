import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import { api } from '../../lib/api';
import { useTenantContextStore } from '../../stores/tenantContextStore';
import { Button } from '../Button';

export const TenantContextBanner: React.FC = () => {
  const navigate = useNavigate();
  const actingTenant = useTenantContextStore((s) => s.actingTenant);
  const exitTenant = useTenantContextStore((s) => s.exitTenant);

  if (!actingTenant) return null;

  return (
    <div className="shrink-0 z-50 border-b border-amber-500/30 bg-amber-500/15 text-amber-950 dark:text-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="text-sm font-medium truncate">
            Super admin viewing tenant{' '}
            <span className="font-bold">{actingTenant.name}</span>
            <span className="text-xs opacity-70 ml-2 font-mono hidden sm:inline">
              {actingTenant.id.slice(0, 8)}…
            </span>
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0 gap-1.5 border-amber-500/40"
          onClick={() => {
            const tenant = actingTenant;
            void api
              .logTenantAccess({
                company_id: tenant.id,
                action: 'exit',
                meta: { company_name: tenant.name },
              })
              .catch(() => {
                /* audit best-effort */
              });
            exitTenant();
            navigate('/super-admin/dashboard');
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit tenant
        </Button>
      </div>
    </div>
  );
};
