import {
  Archive,
  FileCheck2,
  FileClock,
  FileStack,
  HardDrive,
  Link as LinkIcon,
  Users as UsersIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { FadeIn } from '@/components/common/FadeIn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardSummary } from '@/features/dashboard/api';
import { useMyOrganization } from '@/features/organizations/api';
import { useAuthStore } from '@/stores/auth.store';

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-36 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-36 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsOverTimeChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const width = 560;
  const height = 140;
  const barGap = 4;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" preserveAspectRatio="none">
      {data.map((d, i) => {
        const barHeight = (d.count / max) * (height - 20);
        const x = i * (barWidth + barGap);
        const y = height - barHeight;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, d.count > 0 ? 2 : 0)}
              rx={2}
              className="fill-primary"
            >
              <title>
                {d.date}: {d.count}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: org } = useMyOrganization();
  const { data: summary, isLoading } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening in {org?.name ?? 'your organization'}.
        </p>
      </div>

      {isLoading || !summary ? (
        <DashboardSkeleton />
      ) : (
        <FadeIn className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Customers
                </CardTitle>
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.kpis.totalCustomers}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Templates
                </CardTitle>
                <FileStack className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.kpis.totalTemplates}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.kpis.publishedTemplates} published
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Documents
                </CardTitle>
                <FileCheck2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.kpis.totalDocuments}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {Object.entries(summary.kpis.documentsByStatus)
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => `${count} ${status}`)
                    .join(' · ') || 'No documents yet'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Storage Used
                </CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatBytes(summary.kpis.totalStorageBytes)}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.kpis.totalAssets} assets · {formatBytes(summary.kpis.assetsStorageBytes)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Documents over the last 14 days</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentsOverTimeChart data={summary.documentsOverTime} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent documents</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.recentDocuments.length === 0 ? (
                  <EmptyState icon={FileStack} title="No documents yet" />
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {summary.recentDocuments.map((doc) => (
                      <li
                        key={doc._id}
                        className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                      >
                        <span className="capitalize">{doc.status}</span>
                        <span className="text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  to="/documents"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <LinkIcon className="h-3 w-3" /> View all documents
                </Link>
              </CardContent>
            </Card>
          </div>

          {summary.recentActivity && (
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.recentActivity.length === 0 ? (
                  <EmptyState icon={FileClock} title="No activity recorded yet" />
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {summary.recentActivity.map((entry) => (
                      <li
                        key={entry._id}
                        className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                      >
                        <span className="font-mono text-xs">{entry.action}</span>
                        <span className="text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  to="/audit-logs"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Archive className="h-3 w-3" /> View full audit log
                </Link>
              </CardContent>
            </Card>
          )}
        </FadeIn>
      )}
    </div>
  );
}
