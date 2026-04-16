import mongoose, { Schema, Document, Model } from 'mongoose';
import type { ConfidenceLevel, OKRStatus, OwnerRef } from '@/types';

export interface KeyResultDocument extends Document {
  objectiveId: mongoose.Types.ObjectId;
  title: string;
  owners: OwnerRef[];
  metric?: string;
  startValue?: number;
  targetValue?: number;
  currentValue?: number;
  confidence?: ConfidenceLevel;
  comments?: string;
  score?: number;
  status: OKRStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const OwnerRefSchema = new Schema<OwnerRef>(
  {
    type: { type: String, enum: ['user', 'team'], required: true },
    id: { type: String, required: true },
    displayName: { type: String, required: true },
  },
  { _id: false }
);

const KeyResultSchema = new Schema<KeyResultDocument>(
  {
    objectiveId: { type: Schema.Types.ObjectId, ref: 'Objective', required: true },
    title: { type: String, default: '', trim: true },
    owners: { type: [OwnerRefSchema], default: [] },
    metric: { type: String, trim: true },
    startValue: { type: Number },
    targetValue: { type: Number },
    currentValue: { type: Number },
    confidence: { type: String, enum: ['low', 'medium', 'high'] },
    comments: { type: String },
    score: { type: Number, min: 0, max: 1 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

KeyResultSchema.index({ objectiveId: 1, sortOrder: 1 });

const KeyResult: Model<KeyResultDocument> =
  mongoose.models.KeyResult ||
  mongoose.model<KeyResultDocument>('KeyResult', KeyResultSchema);

export default KeyResult;
