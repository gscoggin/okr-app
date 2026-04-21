import mongoose, { Schema, Document, Model } from 'mongoose';
import type { OKRStatus, OwnerRef } from '@/types';

export interface ScoreSnapshot {
  date: Date;
  score: number;
}

export interface ObjectiveDocument extends Document {
  okrPageId: mongoose.Types.ObjectId;
  title: string;
  owners: OwnerRef[];
  priority?: number;
  comments?: string;
  score?: number;
  scoreHistory: ScoreSnapshot[];
  parentObjectiveId?: mongoose.Types.ObjectId;
  sortOrder: number;
  status: OKRStatus;
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

const ScoreSnapshotSchema = new Schema<ScoreSnapshot>(
  {
    date: { type: Date, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const ObjectiveSchema = new Schema<ObjectiveDocument>(
  {
    okrPageId: { type: Schema.Types.ObjectId, ref: 'OKRPage', required: true },
    title: { type: String, default: '', trim: true },
    owners: { type: [OwnerRefSchema], default: [] },
    priority: { type: Number, min: 1 },
    comments: { type: String },
    score: { type: Number, min: 0, max: 1 },
    scoreHistory: { type: [ScoreSnapshotSchema], default: [] },
    parentObjectiveId: { type: Schema.Types.ObjectId, ref: 'Objective' },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true }
);

ObjectiveSchema.index({ okrPageId: 1, sortOrder: 1 });

const Objective: Model<ObjectiveDocument> =
  mongoose.models.Objective ||
  mongoose.model<ObjectiveDocument>('Objective', ObjectiveSchema);

export default Objective;
