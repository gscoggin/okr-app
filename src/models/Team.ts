import mongoose, { Schema, Document, Model } from 'mongoose';
import type { TeamRole } from '@/types';

export interface TeamDocument extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  orgId: mongoose.Types.ObjectId;
  parentTeamId?: mongoose.Types.ObjectId;
  subTeams: mongoose.Types.ObjectId[];
  members: { userId: mongoose.Types.ObjectId; role: TeamRole }[];
  iconUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<TeamDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true },
    parentTeamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    subTeams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'member'], default: 'member' },
      },
    ],
    iconUrl: { type: String },
  },
  { timestamps: true }
);

// Slug must be unique within an org
TeamSchema.index({ orgId: 1, slug: 1 }, { unique: true });

const Team: Model<TeamDocument> =
  mongoose.models.Team || mongoose.model<TeamDocument>('Team', TeamSchema);

export default Team;
