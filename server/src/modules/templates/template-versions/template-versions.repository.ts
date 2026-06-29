import type { TemplateDocument as TemplateLayout } from '@platform/shared';

import {
  TemplateVersionModel,
  type TemplateVersionDocument,
} from '../../../models/template-version.model';
import type { TenantContext } from '../../users/users.repository';

export interface TemplateVersionCreateInput {
  organizationId: string;
  templateId: string;
  versionNumber: number;
  layoutJson: TemplateLayout;
  changeNote?: string;
  createdBy: string;
  isPublished?: boolean;
}

export const templateVersionsRepository = {
  async create(input: TemplateVersionCreateInput): Promise<TemplateVersionDocument> {
    const doc = await TemplateVersionModel.create(input);
    return doc.toObject();
  },

  async findLatest(
    ctx: TenantContext,
    templateId: string,
  ): Promise<TemplateVersionDocument | null> {
    return TemplateVersionModel.findOne({ organizationId: ctx.organizationId, templateId })
      .sort({ versionNumber: -1 })
      .lean();
  },

  async findById(ctx: TenantContext, id: string): Promise<TemplateVersionDocument | null> {
    return TemplateVersionModel.findOne({ _id: id, organizationId: ctx.organizationId }).lean();
  },

  async list(
    ctx: TenantContext,
    templateId: string,
    { page, limit }: { page: number; limit: number },
  ): Promise<{ items: TemplateVersionDocument[]; total: number }> {
    const filter = { organizationId: ctx.organizationId, templateId };
    const [items, total] = await Promise.all([
      TemplateVersionModel.find(filter)
        .sort({ versionNumber: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TemplateVersionModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  async markPublished(ctx: TenantContext, id: string): Promise<TemplateVersionDocument | null> {
    return TemplateVersionModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId },
      { isPublished: true },
      { new: true },
    ).lean();
  },

  /** Delete-guard for the Field Definitions API (PRD 05 §5.7) — a field referenced by any
   * published version, in any template, blocks deletion of that field definition. */
  async existsPublishedReferencingField(ctx: TenantContext, fieldKey: string): Promise<boolean> {
    const match = await TemplateVersionModel.exists({
      organizationId: ctx.organizationId,
      isPublished: true,
      'layoutJson.fields': { $elemMatch: { key: fieldKey } },
    });
    return match !== null;
  },
};
