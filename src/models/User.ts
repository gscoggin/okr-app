import mongoose, { Schema, Document, Model } from 'mongoose';
import type { UserRole, TeamRole } from '@/types';

export interface UserDocument extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  teamMemberships: { teamId: mongoose.Types.ObjectId; role: TeamRole }[];
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'tenant_owner', 'admin', 'member'], default: 'member' },
    teamMemberships: [
      {
        teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
        role: { type: String, enum: ['owner', 'member'], default: 'member' },
      },
    ],
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true }
);

UserSchema.index({ tenantId: 1 });

const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);

export default User;
