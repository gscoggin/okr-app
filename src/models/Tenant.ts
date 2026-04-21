import mongoose, { Schema, Document, Model } from 'mongoose';

export interface TenantBranding {
  logoUrl?: string;
  mission?: string;
  primaryColor?: string;
}

export interface TenantDocument extends Document {
  name: string;
  slug: string;
  ownerId: mongoose.Types.ObjectId;
  branding: TenantBranding;
  guidePage?: string; // markdown
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<TenantDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    branding: {
      logoUrl: { type: String },
      mission: { type: String },
      primaryColor: { type: String },
    },
    guidePage: { type: String },
  },
  { timestamps: true }
);

const Tenant: Model<TenantDocument> =
  mongoose.models.Tenant || mongoose.model<TenantDocument>('Tenant', TenantSchema);

export default Tenant;
