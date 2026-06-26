import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  PAPER_SIZES,
  THEMES,
  updateOrganizationSchema,
  updateSettingsSchema,
  type UpdateOrganizationInput,
  type UpdateSettingsInput,
} from '@platform/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMyOrganization, useUpdateMyOrganization } from '@/features/organizations/api';
import { useSettings, useUpdateSettings } from '@/features/settings/api';

function BrandingForm() {
  const { data: org, isLoading } = useMyOrganization();
  const updateOrg = useUpdateMyOrganization();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateOrganizationInput>({ resolver: zodResolver(updateOrganizationSchema) });

  useEffect(() => {
    if (org)
      reset({ name: org.name, primaryColor: org.primaryColor, secondaryColor: org.secondaryColor });
  }, [org, reset]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
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
        <Label htmlFor="primaryColor">Primary color</Label>
        <Input id="primaryColor" type="text" placeholder="#002970" {...register('primaryColor')} />
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
          Save branding
        </Button>
        {updateOrg.isSuccess && <span className="ml-3 text-sm text-muted-foreground">Saved.</span>}
      </div>
    </form>
  );
}

function PreferencesForm() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { register, handleSubmit, reset } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
  });

  useEffect(() => {
    if (settings) {
      reset({
        theme: settings.theme as UpdateSettingsInput['theme'],
        language: settings.language,
        defaultCurrency: settings.defaultCurrency,
        defaultTimezone: settings.defaultTimezone,
        defaultPaperSize: settings.defaultPaperSize as UpdateSettingsInput['defaultPaperSize'],
      });
    }
  }, [settings, reset]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit((input) => updateSettings.mutate(input))}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="theme">Theme</Label>
        <select
          id="theme"
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          {...register('theme')}
        >
          {THEMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="language">Language</Label>
        <Input id="language" maxLength={10} {...register('language')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultCurrency">Default currency (ISO 4217)</Label>
        <Input id="defaultCurrency" maxLength={3} {...register('defaultCurrency')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultTimezone">Default timezone (IANA)</Label>
        <Input id="defaultTimezone" {...register('defaultTimezone')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultPaperSize">Default paper size</Label>
        <select
          id="defaultPaperSize"
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          {...register('defaultPaperSize')}
        >
          {PAPER_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" isLoading={updateSettings.isPending}>
          Save preferences
        </Button>
        {updateSettings.isSuccess && (
          <span className="ml-3 text-sm text-muted-foreground">Saved.</span>
        )}
      </div>
    </form>
  );
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Branding defaults and document preferences for your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandingForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm />
        </CardContent>
      </Card>
    </div>
  );
}
