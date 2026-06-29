import { FileClock } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { FadeIn } from '@/components/common/FadeIn';
import { TableSkeleton } from '@/components/common/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuditLogs } from '@/features/audit-logs/api';

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLogs(page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-muted-foreground">Every state-changing action, who did it, and when.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity ({data?.meta?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton cols={4} />
          ) : (
            <FadeIn>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">Action</th>
                    <th className="py-2">Entity</th>
                    <th className="py-2">IP Address</th>
                    <th className="py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((entry) => (
                    <tr key={entry._id} className="border-b border-border last:border-0">
                      <td className="py-2 font-mono text-xs">{entry.action}</td>
                      <td className="py-2">
                        {entry.entityType}
                        {entry.entityId ? ` #${entry.entityId.slice(-6)}` : ''}
                      </td>
                      <td className="py-2">{entry.ipAddress ?? '—'}</td>
                      <td className="py-2">{new Date(entry.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {data?.items.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState icon={FileClock} title="No activity recorded yet" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </FadeIn>
          )}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
