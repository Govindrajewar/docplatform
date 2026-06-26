import { RoleModel, type RoleDocument } from '../../models/role.model';

export const rolesRepository = {
  async findByName(name: string): Promise<RoleDocument | null> {
    return RoleModel.findOne({ name }).lean();
  },

  async findById(roleId: string): Promise<RoleDocument | null> {
    return RoleModel.findById(roleId).lean();
  },

  async listAll(): Promise<RoleDocument[]> {
    return RoleModel.find().lean();
  },
};
