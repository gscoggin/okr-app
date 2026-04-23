import mongoose, { Schema, Document, Model } from 'mongoose';

export interface AccessRequestDocument extends Document {
  name: string;
  email: string;
  useCase?: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: Date;
  updatedAt: Date;
}

const AccessRequestSchema = new Schema<AccessRequestDocument>(
  {
    name:    { type: String, required: true, trim: true },
    email:   { type: String, required: true, trim: true, lowercase: true },
    useCase: { type: String, trim: true },
    status:  { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);

AccessRequestSchema.index({ status: 1, createdAt: -1 });

const AccessRequest: Model<AccessRequestDocument> =
  mongoose.models.AccessRequest ||
  mongoose.model<AccessRequestDocument>('AccessRequest', AccessRequestSchema);

export default AccessRequest;
