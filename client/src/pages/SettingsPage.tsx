import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { updateOrganizationSchema, type UpdateOrganizationInput } from '@platform/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMyOrganization, useUpdateMyOrganization } from '@/features/organizations/api';

export function SettingsPage() {
  const { data: org, isLoading } = useMyOrganization();
  const updateOrg = useUpdateMyOrganization();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateOrganizationInput>({ resolver: zodResolver(updateOrganizationSchema) });

  useEffect(() => {
    if (org) {
      reset({
        name: org.name,
        primaryColor: org.primaryColor,
        secondaryColor: org.secondaryColor,
        defaultCurrency: org.defaultCurrency,
        defaultPaperSize: org.defaultPaperSize as 'A4' | 'LETTER' | 'LEGAL',
      });
    }
  }, [org, reset]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground">Branding defaults applied to every new template.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={handleSubmit((input) => updateOrg.mutate(input))}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="defaultCurrency">Default currency (ISO 4217)</Label>
              <Input id="defaultCurrency" maxLength={3} {...register('defaultCurrency')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primaryColor">Primary color</Label>
              <Input
                id="primaryColor"
                type="text"
                placeholder="#002970"
                {...register('primaryColor')}
              />
              {errors.primaryColor && (
                <p className="text-sm text-destructive">{errors.primaryColor.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="secondaryColor">Secondary color</Label>
              <Input
                id="secondaryColor"
                type="text"
                placeholder="#6B7280"
                {...register('secondaryColor')}
              />
              {errors.secondaryColor && (
                <p className="text-sm text-destructive">{errors.secondaryColor.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" isLoading={updateOrg.isPending}>
                Save changes
              </Button>
              {updateOrg.isSuccess && (
                <span className="ml-3 text-sm text-muted-foreground">Saved.</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
