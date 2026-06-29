import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FieldDefinition } from '@platform/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomers } from '@/features/customers/api';
import {
  useBatch,
  useBulkGenerate,
  useCreateDocument,
  useImportPreview,
  type ImportPreviewResult,
} from '@/features/documents/api';
import { useTemplate, useTemplateVersion } from '@/features/templates/api';
import { setByPath } from '@/lib/path';

function coerceFieldValue(field: FieldDefinition, raw: string | boolean): unknown {
  if (raw === '' || raw === undefined) return undefined;
  if (field.type === 'number' || field.type === 'currency') {
    const num = Number(raw);
    return Number.isNaN(num) ? undefined : num;
  }
  if (field.type === 'boolean') return Boolean(raw);
  return raw;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  if (field.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    );
  }
  const inputType = field.type === 'date' ? 'date' : field.type === 'text' ? 'text' : 'number';
  return (
    <Input
      type={inputType}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function BatchProgress({ batchId, onReset }: { batchId: string; onReset: () => void }) {
  const { data: batch } = useBatch(batchId);
  if (!batch) return <p className="text-sm text-muted-foreground">Loading batch status…</p>;

  const done = batch.completed + batch.failed >= batch.total;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {batch.completed + batch.failed} / {batch.total} processed — {batch.completed} generated,{' '}
        {batch.failed} failed.
        {!done && ' Still working…'}
      </p>
      {batch.failures.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm text-destructive">
          {batch.failures.map((f) => (
            <li key={f.row}>
              Row {f.row + 1}: {f.reason}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Link to="/documents" className="text-sm text-primary hover:underline">
          View in Documents
        </Link>
        {done && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Start another import
          </Button>
        )}
      </div>
    </div>
  );
}

export function TemplateGeneratePage() {
  const { id: templateId } = useParams<{ id: string }>();
  const { data: template } = useTemplate(templateId);
  const currentVersionId = template?.currentVersionId ?? undefined;
  const { data: version } = useTemplateVersion(templateId, currentVersionId);
  const fields = version?.layoutJson.fields ?? [];

  const { data: customers } = useCustomers(1, 100);
  const createDocument = useCreateDocument();
  const importPreview = useImportPreview();
  const bulkGenerate = useBulkGenerate();

  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [customerId, setCustomerId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [customerIdColumn, setCustomerIdColumn] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const missingRequired = useMemo(
    () => fields.filter((f) => f.required && !formValues[f.key] && formValues[f.key] !== false),
    [fields, formValues],
  );

  const handleGenerateOne = () => {
    if (missingRequired.length > 0) {
      setFormError(`Missing required fields: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }
    setFormError(null);
    const dataPayload: Record<string, unknown> = {};
    for (const field of fields) {
      const coerced = coerceFieldValue(field, formValues[field.key] ?? '');
      if (coerced !== undefined) setByPath(dataPayload, field.key, coerced);
    }
    createDocument.mutate(
      { templateId: templateId ?? '', customerId: customerId || undefined, dataPayload },
      { onSuccess: () => setFormValues({}) },
    );
  };

  const handleFileSelected = (selected: File) => {
    setFile(selected);
    setBatchId(null);
    importPreview.mutate(
      { templateId: templateId ?? '', file: selected },
      {
        onSuccess: (result) => {
          setPreview(result);
          setMapping(result.suggestedMapping);
        },
      },
    );
  };

  const handleConfirmImport = () => {
    if (!preview) return;
    const rows = preview.rows.map((rawRow) => {
      const row: Record<string, unknown> = {};
      for (const field of fields) {
        const column = mapping[field.key];
        if (column) row[field.key] = rawRow[column];
      }
      if (customerIdColumn) {
        const value = rawRow[customerIdColumn];
        if (value) row.customerId = value;
      }
      return row;
    });
    bulkGenerate.mutate(
      { templateId: templateId ?? '', rows },
      { onSuccess: (result) => setBatchId(result.batchId) },
    );
  };

  const resetImport = () => {
    setFile(null);
    setPreview(null);
    setMapping({});
    setCustomerIdColumn('');
    setBatchId(null);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  if (!template) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!currentVersionId) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This template has no published version yet — publish it before generating documents.
            </p>
            <Link
              to={`/templates/${templateId}/design`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Open the Designer
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Generate — {template.name}</h1>
        <p className="text-muted-foreground">
          Fill in one document by hand, or import a file to generate many at once.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate one document</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This template declares no fields — it can still be generated as-is.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
                <FieldInput
                  field={field}
                  value={formValues[field.key] ?? ''}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, [field.key]: value }))}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <Label>Customer (optional)</Label>
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">— none —</option>
                {customers?.items.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          {createDocument.isError && (
            <p className="text-sm text-destructive">{(createDocument.error as Error).message}</p>
          )}
          {createDocument.isSuccess && (
            <p className="text-sm text-primary">
              Document created — status: {createDocument.data.status}.{' '}
              <Link to="/documents" className="hover:underline">
                View in Documents
              </Link>
            </p>
          )}
          <Button
            className="w-fit"
            onClick={handleGenerateOne}
            isLoading={createDocument.isPending}
          >
            Generate document
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk import (CSV / Excel / JSON)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!preview && (
            <div>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleFileSelected(selected);
                }}
              />
              <Button
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                isLoading={importPreview.isPending}
              >
                Choose file
              </Button>
              {file && <span className="ml-3 text-sm text-muted-foreground">{file.name}</span>}
              {importPreview.isError && (
                <p className="mt-2 text-sm text-destructive">
                  {(importPreview.error as Error).message}
                </p>
              )}
            </div>
          )}

          {preview && !batchId && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {preview.rows.length} row(s) parsed. Confirm the column mapping below.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">Field</th>
                    <th className="py-2">Source column</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.key} className="border-b border-border last:border-0">
                      <td className="py-2">
                        {field.label}
                        {field.required && <span className="text-destructive"> *</span>}
                      </td>
                      <td className="py-2">
                        <select
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                          value={mapping[field.key] ?? ''}
                          onChange={(e) =>
                            setMapping((prev) => ({
                              ...prev,
                              [field.key]: e.target.value || null,
                            }))
                          }
                        >
                          <option value="">— none —</option>
                          {preview.columns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2">Customer ID (optional)</td>
                    <td className="py-2">
                      <select
                        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                        value={customerIdColumn}
                        onChange={(e) => setCustomerIdColumn(e.target.value)}
                      >
                        <option value="">— none —</option>
                        {preview.columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
              {bulkGenerate.isError && (
                <p className="text-sm text-destructive">{(bulkGenerate.error as Error).message}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleConfirmImport} isLoading={bulkGenerate.isPending}>
                  Confirm & generate {preview.rows.length} document(s)
                </Button>
                <Button variant="ghost" onClick={resetImport}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {batchId && <BatchProgress batchId={batchId} onReset={resetImport} />}
        </CardContent>
      </Card>
    </div>
  );
}
