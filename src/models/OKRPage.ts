import mongoose, { Schema, Document, Model } from 'mongoose';
import type { OKRStatus, PeriodType, Quarter } from '@/types';

export interface OKRPageDocument extends Document {
  tenantId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  period: {
    type: PeriodType;
    year: number;
    quarter?: Quarter;
  };
  status: OKRStatus;
  parentOKRPageId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OKRPageSchema = new Schema<OKRPageDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    period: {
      type: {
        type: String,
        enum: ['annual', 'quarterly'],
        required: true,
      },
      year: { type: Number, required: true },
      quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'] },
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    parentOKRPageId: { type: Schema.Types.ObjectId, ref: 'OKRPage' },
  },
  { timestamps: true }
);

// Unique page per team + period
OKRPageSchema.index(
  { teamId: 1, 'period.type': 1, 'period.year': 1, 'period.quarter': 1 },
  { unique: true }
);

const OKRPage: Model<OKRPageDocument> =
  mongoose.models.OKRPage ||
  mongoose.model<OKRPageDocument>('OKRPage', OKRPageSchema);

export default OKRPage;
