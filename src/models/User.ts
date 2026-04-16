import mongoose, { Schema, Document, Model } from 'mongoose';
import type { UserRole, TeamRole } from '@/types';

export interface UserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  teamMemberships: { teamId: mongoose.Types.ObjectId; role: TeamRole }[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    teamMemberships: [
      {
        teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
        role: { type: String, enum: ['owner', 'member'], default: 'member' },
      },
    ],
  },
  { timestamps: true }
);

const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);

export default User;
