import mongoose, { Schema, Document, Model } from 'mongoose';

export type ArchiveType = 'org' | 'team' | 'year';

export interface ArchiveDocument extends Document {
  type: ArchiveType;
  name: string;
  compressedData: Buffer;
  archivedAt: Date;
  archivedBy: mongoose.Types.ObjectId;
  originalId: string; // org/team _id, or year as string e.g. "2022"
  metadata: {
    orgId?: string;
    teamId?: string;
    year?: number;
    pageCount?: number;
    autoArchived?: boolean;
  };
}

const ArchiveSchema = new Schema<ArchiveDocument>(
  {
    type: { type: String, enum: ['org', 'team', 'year'], required: true },
    name: { type: String, required: true },
    compressedData: { type: Buffer, required: true },
    archivedAt: { type: Date, default: Date.now },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: false }
);

ArchiveSchema.index({ type: 1, originalId: 1 });

const Archive: Model<ArchiveDocument> =
  mongoose.models.Archive || mongoose.model<ArchiveDocument>('Archive', ArchiveSchema);

export default Archive;
