import mongoose, { Document, Schema } from "mongoose";

interface CivilCauseActivePrimitives extends Document {
  rol: string;
  court: string;
  cover: string;
  admissionAt: Date;
  processBook: string;
  book: string;
}

const CauseCivilActiveSchema = new Schema<CivilCauseActivePrimitives>(
  {
    rol: { type: String },
    court: { type: String },
    cover: { type: String },
    admissionAt: { type: Date },
    book: { type: String },
    processBook: { type: String },
  },
  {
    timestamps: true,
  }
);

export const CivilCauseActive = mongoose.model<CivilCauseActivePrimitives>(
  "CauseCivilActive",
  CauseCivilActiveSchema
);
