import mongoose, { Schema, Document, Model } from 'mongoose';

export interface InviteCodeDocument extends Document {
  code: string;
  createdBy: mongoose.Types.ObjectId;
  note?: string;
  expiresAt: Date;
  usedBy?: mongoose.Types.ObjectId;
  usedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InviteCodeSchema = new Schema<InviteCodeDocument>(
  {
    code:      { type: String, required: true, unique: true, uppercase: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note:      { type: String },
    expiresAt: { type: Date, required: true },
    usedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
    usedAt:    { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

InviteCodeSchema.index({ expiresAt: 1 });

const InviteCode: Model<InviteCodeDocument> =
  mongoose.models.InviteCode ||
  mongoose.model<InviteCodeDocument>('InviteCode', InviteCodeSchema);

export default InviteCode;
