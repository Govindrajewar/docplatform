import { templateDocumentSchema } from '@platform/shared';
import type {
  CreateTemplateInput,
  ImportTemplateBundleInput,
  PreviewTemplateInput,
  SaveTemplateVersionInput,
  TemplateDocument as TemplateLayout,
  UpdateTemplateInput,
} from '@platform/shared';

import { render } from '../../engine/render';
import { AppError } from '../../utils/app-error';
import type { TenantContext } from '../users/users.repository';
import type { TemplateVersionDocument } from '../../models/template-version.model';

import {
  buildAssetMap,
  collectLiteralAssetReferences,
  collectPreviewAssetReferences,
  findBrokenAssetReferences,
} from './asset-references';
import { diffTemplateVersions } from './template-diff';
import { templatesRepository } from './templates.repository';
import { templateVersionsRepository } from './template-versions/template-versions.repository';

/** A brand-new template starts from this skeleton — every nested field has a schema default,
 * so this is just enough structure to satisfy the required top-level `page`/`theme` keys. */
const BLANK_LAYOUT: TemplateLayout = templateDocumentSchema.parse({
  page: {},
  theme: {},
  sections: [],
  fields: [],
});

async function requireTemplate(ctx: TenantContext, id: string) {
  const template = await templatesRepository.findById(ctx, id);
  if (!template) throw new AppError('NOT_FOUND', 'Template not found');
  return template;
}

async function requireVersionOfTemplate(
  ctx: TenantContext,
  templateId: string,
  versionId: string,
): Promise<TemplateVersionDocument> {
  const version = await templateVersionsRepository.findById(ctx, versionId);
  if (!version || version.templateId.toString() !== templateId) {
    throw new AppError('NOT_FOUND', 'Template version not found');
  }
  return version;
}

/** The version a designer/export/duplicate operation should treat as "the current layout" —
 * the published version if one exists, otherwise the latest draft (PRD 05 §5.6). */
async function resolveWorkingVersion(
  ctx: TenantContext,
  template: { _id: { toString(): string }; currentVersionId?: unknown },
): Promise<TemplateVersionDocument> {
  if (template.currentVersionId) {
    const published = await templateVersionsRepository.findById(
      ctx,
      String(template.currentVersionId),
    );
    if (published) return published;
  }
  const latest = await templateVersionsRepository.findLatest(ctx, template._id.toString());
  if (!latest) throw new AppError('INTERNAL_ERROR', 'Template has no versions');
  return latest;
}

export const templatesService = {
  async list(ctx: TenantContext, options: Parameters<typeof templatesRepository.list>[1]) {
    return templatesRepository.list(ctx, options);
  },

  async get(ctx: TenantContext, id: string) {
    const template = await requireTemplate(ctx, id);
    const latestVersion = await resolveWorkingVersion(ctx, template);
    return { ...template, latestVersion };
  },

  async create(ctx: TenantContext, actorId: string, input: CreateTemplateInput) {
    const template = await templatesRepository.create({
      organizationId: ctx.organizationId,
      name: input.name,
      documentType: input.documentType,
      tags: input.tags,
      createdBy: actorId,
    });
    const version = await templateVersionsRepository.create({
      organizationId: ctx.organizationId,
      templateId: template._id.toString(),
      versionNumber: 1,
      layoutJson: BLANK_LAYOUT,
      createdBy: actorId,
      isPublished: false,
    });
    return { ...template, version };
  },

  async updateMetadata(ctx: TenantContext, id: string, input: UpdateTemplateInput) {
    const updated = await templatesRepository.updateMetadata(ctx, id, input);
    if (!updated) throw new AppError('NOT_FOUND', 'Template not found');
    return updated;
  },

  async archive(ctx: TenantContext, id: string) {
    const updated = await templatesRepository.setStatus(ctx, id, 'archived');
    if (!updated) throw new AppError('NOT_FOUND', 'Template not found');
    return updated;
  },

  async duplicate(ctx: TenantContext, actorId: string, id: string) {
    const original = await requireTemplate(ctx, id);
    const sourceVersion = await resolveWorkingVersion(ctx, original);

    const template = await templatesRepository.create({
      organizationId: ctx.organizationId,
      name: `${original.name} (Copy)`,
      documentType: original.documentType,
      tags: original.tags,
      createdBy: actorId,
    });
    const version = await templateVersionsRepository.create({
      organizationId: ctx.organizationId,
      templateId: template._id.toString(),
      versionNumber: 1,
      layoutJson: sourceVersion.layoutJson as TemplateLayout,
      createdBy: actorId,
      isPublished: false,
    });
    return { ...template, version };
  },

  async exportBundle(ctx: TenantContext, id: string) {
    const template = await requireTemplate(ctx, id);
    const version = await resolveWorkingVersion(ctx, template);
    const layoutJson = version.layoutJson as TemplateLayout;
    return {
      name: template.name,
      documentType: template.documentType,
      layoutJson,
      assetReferences: collectLiteralAssetReferences(layoutJson),
    };
  },

  async importBundle(ctx: TenantContext, actorId: string, input: ImportTemplateBundleInput) {
    const template = await templatesRepository.create({
      organizationId: ctx.organizationId,
      name: input.name,
      documentType: input.documentType,
      createdBy: actorId,
    });
    const version = await templateVersionsRepository.create({
      organizationId: ctx.organizationId,
      templateId: template._id.toString(),
      versionNumber: 1,
      layoutJson: input.layoutJson,
      createdBy: actorId,
      isPublished: false,
    });
    return { ...template, version };
  },

  versions: {
    async list(ctx: TenantContext, templateId: string, options: { page: number; limit: number }) {
      await requireTemplate(ctx, templateId);
      return templateVersionsRepository.list(ctx, templateId, options);
    },

    async get(ctx: TenantContext, templateId: string, versionId: string) {
      await requireTemplate(ctx, templateId);
      return requireVersionOfTemplate(ctx, templateId, versionId);
    },

    /** Optimistic-concurrency save (PRD 10 §10.3): a save based on a stale `baseVersionNumber`
     * is rejected with 409 rather than silently overwriting a concurrent edit. */
    async save(
      ctx: TenantContext,
      actorId: string,
      templateId: string,
      input: SaveTemplateVersionInput,
    ) {
      await requireTemplate(ctx, templateId);
      const latest = await templateVersionsRepository.findLatest(ctx, templateId);
      if (!latest) throw new AppError('INTERNAL_ERROR', 'Template has no versions');

      if (
        input.baseVersionNumber !== undefined &&
        input.baseVersionNumber !== latest.versionNumber
      ) {
        throw new AppError(
          'STALE_VERSION',
          `This template has moved on to version ${latest.versionNumber} since you loaded version ${input.baseVersionNumber} — reload and reapply your changes`,
        );
      }

      return templateVersionsRepository.create({
        organizationId: ctx.organizationId,
        templateId,
        versionNumber: latest.versionNumber + 1,
        layoutJson: input.layoutJson,
        changeNote: input.changeNote,
        createdBy: actorId,
        isPublished: false,
      });
    },

    async publish(ctx: TenantContext, templateId: string, versionId: string) {
      await requireTemplate(ctx, templateId);
      const version = await requireVersionOfTemplate(ctx, templateId, versionId);

      const broken = await findBrokenAssetReferences(ctx, version.layoutJson as TemplateLayout);
      if (broken.length > 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Cannot publish: this version references assets that no longer exist',
          broken.map((assetId) => ({ field: 'assetReferences', message: assetId })),
        );
      }

      await templateVersionsRepository.markPublished(ctx, versionId);
      const template = await templatesRepository.setCurrentVersion(ctx, templateId, versionId);
      if (!template) throw new AppError('NOT_FOUND', 'Template not found');
      return template;
    },

    /** Restore = rollback (PRD 06 §6.4): never rewrites history — creates a new version copying
     * the selected one's layout, then publishes it immediately, so version history stays a
     * forward-only, always-answerable "what was published when" sequence. */
    async restore(ctx: TenantContext, actorId: string, templateId: string, versionId: string) {
      await requireTemplate(ctx, templateId);
      const source = await requireVersionOfTemplate(ctx, templateId, versionId);
      const latest = await templateVersionsRepository.findLatest(ctx, templateId);
      if (!latest) throw new AppError('INTERNAL_ERROR', 'Template has no versions');

      const layoutJson = source.layoutJson as TemplateLayout;
      const broken = await findBrokenAssetReferences(ctx, layoutJson);
      if (broken.length > 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Cannot restore: this version references assets that no longer exist',
          broken.map((assetId) => ({ field: 'assetReferences', message: assetId })),
        );
      }

      const restored = await templateVersionsRepository.create({
        organizationId: ctx.organizationId,
        templateId,
        versionNumber: latest.versionNumber + 1,
        layoutJson,
        changeNote: `Restored from version ${source.versionNumber}`,
        createdBy: actorId,
        isPublished: false,
      });
      await templateVersionsRepository.markPublished(ctx, restored._id.toString());
      const template = await templatesRepository.setCurrentVersion(
        ctx,
        templateId,
        restored._id.toString(),
      );
      if (!template) throw new AppError('NOT_FOUND', 'Template not found');
      return { ...template, version: restored };
    },

    async compare(
      ctx: TenantContext,
      templateId: string,
      fromVersionId: string,
      toVersionId: string,
    ) {
      await requireTemplate(ctx, templateId);
      const [from, to] = await Promise.all([
        requireVersionOfTemplate(ctx, templateId, fromVersionId),
        requireVersionOfTemplate(ctx, templateId, toVersionId),
      ]);
      return diffTemplateVersions(
        from.layoutJson as TemplateLayout,
        to.layoutJson as TemplateLayout,
      );
    },
  },

  /** Fast-path preview (PRD 06 §6.2/§6.5) — renders in-process, never queued, never persisted. */
  async preview(ctx: TenantContext, templateId: string, input: PreviewTemplateInput) {
    const template = await requireTemplate(ctx, templateId);

    let layoutJson: TemplateLayout;
    if (input.layoutJson) {
      layoutJson = input.layoutJson;
    } else if (input.versionId) {
      const version = await requireVersionOfTemplate(ctx, templateId, input.versionId);
      layoutJson = version.layoutJson as TemplateLayout;
    } else {
      const version = await resolveWorkingVersion(ctx, template);
      layoutJson = version.layoutJson as TemplateLayout;
    }

    const assetIds = collectPreviewAssetReferences(layoutJson, input.sampleData);
    const assets = await buildAssetMap(ctx, assetIds);

    return render({ template: layoutJson, data: input.sampleData, assets });
  },
};
