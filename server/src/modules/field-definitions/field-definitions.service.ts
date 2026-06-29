import {
  SYSTEM_FIELDS,
  type CreateFieldDefinitionInput,
  type UpdateFieldDefinitionInput,
} from '@platform/shared';

import { AppError } from '../../utils/app-error';
import { templateVersionsRepository } from '../templates/template-versions/template-versions.repository';
import type { TenantContext } from '../users/users.repository';

import { fieldDefinitionsRepository } from './field-definitions.repository';

export const fieldDefinitionsService = {
  /** System fields (PRD 04 §4.6) are never persisted — merged in on every read so the Designer's
   * field picker and the auto-generated data-entry form (Phase 5) see one combined list. */
  async list(ctx: TenantContext) {
    const custom = await fieldDefinitionsRepository.list(ctx);
    return [...SYSTEM_FIELDS, ...custom];
  },

  async create(ctx: TenantContext, input: CreateFieldDefinitionInput) {
    const existing = await fieldDefinitionsRepository.findByKey(ctx, input.key);
    if (existing) {
      throw new AppError('CONFLICT', `A field with key "${input.key}" already exists`);
    }
    return fieldDefinitionsRepository.create(ctx, input);
  },

  async update(ctx: TenantContext, id: string, input: UpdateFieldDefinitionInput) {
    const updated = await fieldDefinitionsRepository.updateById(ctx, id, input);
    if (!updated) throw new AppError('NOT_FOUND', 'Field definition not found');
    return updated;
  },

  async remove(ctx: TenantContext, id: string) {
    const field = await fieldDefinitionsRepository.findById(ctx, id);
    if (!field) throw new AppError('NOT_FOUND', 'Field definition not found');

    const referenced = await templateVersionsRepository.existsPublishedReferencingField(
      ctx,
      field.key,
    );
    if (referenced) {
      throw new AppError(
        'CONFLICT',
        `Field "${field.key}" is referenced by a published template and cannot be deleted`,
      );
    }

    await fieldDefinitionsRepository.deleteById(ctx, id);
  },
};
