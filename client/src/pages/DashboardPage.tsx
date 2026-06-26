import { Building2, Users as UsersIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyOrganization } from '@/features/organizations/api';
import { useUsers } from '@/features/users/api';
import { useAuthStore } from '@/stores/auth.store';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: org } = useMyOrganization();
  const { data: usersData } = useUsers(1, 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening in {org?.name ?? 'your organization'}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{usersData?.meta?.total ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Organization
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{org?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              {org?.defaultCurrency} · {org?.defaultPaperSize}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming up</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Templates, Documents, Customers, and Asset management ship in Phases 2-5 (see{' '}
          <code>docs/PRD/11-roadmap-and-phased-plan.md</code>). This dashboard will gain
          recent-activity and generated-PDF widgets as those modules come online.
        </CardContent>
      </Card>
    </div>
  );
}
