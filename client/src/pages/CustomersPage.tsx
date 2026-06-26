import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createCustomerSchema, type CreateCustomerInput } from '@platform/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateCustomer, useCustomers, useDeleteCustomer } from '@/features/customers/api';

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, isLoading } = useCustomers(page, 20, q || undefined);
  const createCustomer = useCreateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCustomerInput>({ resolver: zodResolver(createCustomerSchema) });

  const onSubmit = (input: CreateCustomerInput) => {
    const cleaned = { ...input, email: input.email || undefined, phone: input.phone || undefined };
    createCustomer.mutate(cleaned, { onSuccess: () => reset() });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-muted-foreground">
          The people and accounts your documents are generated for.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
            <Button type="submit" isLoading={createCustomer.isPending}>
              Add customer
            </Button>
          </form>
          {createCustomer.isError && (
            <p className="mt-2 text-sm text-destructive">
              {(createCustomer.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>All customers ({data?.meta?.total ?? 0})</CardTitle>
          <Input
            placeholder="Search by name or email…"
            className="max-w-xs"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((c) => (
                  <tr key={c._id} className="border-b border-border last:border-0">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2">{c.email ?? '—'}</td>
                    <td className="py-2">{c.phone ?? '—'}</td>
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCustomer.mutate(c._id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No customers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
