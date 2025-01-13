import { Schema, model, Document, Types } from "mongoose";

export interface ProcessStatusDocument extends Document {
  _id: string;
  name: string;
  state: "pending" | "success" | "failed";
  error?: any;
  createdAt: Date;
  updatedAt: Date;
}

const processStatusSchema = new Schema<ProcessStatusDocument>(
  {
    name: { type: String, required: true },
    state: {
      type: String,
      enum: ["pending", "success", "failed"],
      required: true,
    },
    error: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const ProcessStatusModel = model<ProcessStatusDocument>(
  "ProcessStatus",
  processStatusSchema
);
