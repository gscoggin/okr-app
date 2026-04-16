import mongoose, { Schema, Document, Model } from 'mongoose';

export interface OrgDocument extends Document {
  name: string;
  slug: string;
  teams: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const OrgSchema = new Schema<OrgDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  },
  { timestamps: true }
);

const Org: Model<OrgDocument> =
  mongoose.models.Org || mongoose.model<OrgDocument>('Org', OrgSchema);

export default Org;
