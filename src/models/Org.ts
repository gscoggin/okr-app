import mongoose, { Schema, Document, Model } from 'mongoose';

export interface OrgDocument extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  teams: mongoose.Types.ObjectId[];
  iconUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrgSchema = new Schema<OrgDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: false, lowercase: true, trim: true },
    teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    iconUrl: { type: String },
  },
  { timestamps: true }
);

OrgSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

const Org: Model<OrgDocument> =
  mongoose.models.Org || mongoose.model<OrgDocument>('Org', OrgSchema);

export default Org;
