import { Image } from 'lucide-react';
import { useRef, useState } from 'react';
import { ASSET_TYPES, type AssetType } from '@platform/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { FadeIn } from '@/components/common/FadeIn';
import { TableSkeleton } from '@/components/common/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { openAssetFile, useAssets, useDeleteAsset, useUploadAsset } from '@/features/assets/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetsPage() {
  const [type, setType] = useState<AssetType>('logo');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useAssets(1, 50);
  const uploadAsset = useUploadAsset();
  const deleteAsset = useDeleteAsset();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAsset.mutate(
      { file, type },
      {
        onSettled: () => {
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="text-muted-foreground">
          Logos, icons, fonts, images, and signatures used by templates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload an asset</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-type">Type</Label>
              <select
                id="asset-type"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as AssetType)}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-file">File</Label>
              <input
                ref={fileInputRef}
                id="asset-file"
                type="file"
                className="text-sm"
                onChange={handleFileChange}
                disabled={uploadAsset.isPending}
              />
            </div>
            {uploadAsset.isPending && <p className="text-sm text-muted-foreground">Uploading…</p>}
          </div>
          {uploadAsset.isError && (
            <p className="mt-2 text-sm text-destructive">{(uploadAsset.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All assets ({data?.meta?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton cols={4} />
          ) : (
            <FadeIn>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">File</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Size</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((asset) => (
                    <tr key={asset._id} className="border-b border-border last:border-0">
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => openAssetFile(asset._id)}
                          className="text-primary hover:underline"
                        >
                          {asset.originalFilename}
                        </button>
                      </td>
                      <td className="py-2 capitalize">{asset.type}</td>
                      <td className="py-2">{formatBytes(asset.sizeBytes)}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAsset.mutate(asset._id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {data?.items.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState
                          icon={Image}
                          title="No assets uploaded yet"
                          description="Upload a logo, signature, or font above to use it in your templates."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </FadeIn>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
