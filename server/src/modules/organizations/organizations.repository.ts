import { OrganizationModel, type OrganizationDocument } from '../../models/organization.model';

export const organizationsRepository = {
  async create(data: { name: string; slug: string }): Promise<OrganizationDocument> {
    const doc = await OrganizationModel.create(data);
    return doc.toObject();
  },

  async findBySlug(slug: string): Promise<OrganizationDocument | null> {
    const doc = await OrganizationModel.findOne({ slug }).lean();
    return doc;
  },

  async findById(organizationId: string): Promise<OrganizationDocument | null> {
    const doc = await OrganizationModel.findById(organizationId).lean();
    return doc;
  },

  async updateById(
    organizationId: string,
    update: Partial<OrganizationDocument>,
  ): Promise<OrganizationDocument | null> {
    const doc = await OrganizationModel.findByIdAndUpdate(organizationId, update, {
      new: true,
    }).lean();
    return doc;
  },
};
