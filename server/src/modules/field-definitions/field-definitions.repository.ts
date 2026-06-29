import type { CreateFieldDefinitionInput, UpdateFieldDefinitionInput } from '@platform/shared';

import {
  FieldDefinitionModel,
  type FieldDefinitionDocument,
} from '../../models/field-definition.model';
import type { TenantContext } from '../users/users.repository';

export const fieldDefinitionsRepository = {
  async create(
    ctx: TenantContext,
    input: CreateFieldDefinitionInput,
  ): Promise<FieldDefinitionDocument> {
    const doc = await FieldDefinitionModel.create({ organizationId: ctx.organizationId, ...input });
    return doc.toObject();
  },

  async findByKey(ctx: TenantContext, key: string): Promise<FieldDefinitionDocument | null> {
    return FieldDefinitionModel.findOne({ organizationId: ctx.organizationId, key }).lean();
  },

  async findById(ctx: TenantContext, id: string): Promise<FieldDefinitionDocument | null> {
    return FieldDefinitionModel.findOne({ _id: id, organizationId: ctx.organizationId }).lean();
  },

  async list(ctx: TenantContext): Promise<FieldDefinitionDocument[]> {
    return FieldDefinitionModel.find({ organizationId: ctx.organizationId })
      .sort({ key: 1 })
      .lean();
  },

  async updateById(
    ctx: TenantContext,
    id: string,
    update: UpdateFieldDefinitionInput,
  ): Promise<FieldDefinitionDocument | null> {
    return FieldDefinitionModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId },
      update,
      { new: true },
    ).lean();
  },

  async deleteById(ctx: TenantContext, id: string): Promise<FieldDefinitionDocument | null> {
    return FieldDefinitionModel.findOneAndDelete({
      _id: id,
      organizationId: ctx.organizationId,
    }).lean();
  },
};
