import mongoose, { Document, Schema } from "mongoose";

interface CauseCivilPrimitives extends Document {
  rol: string;
  cover: string;
  estAdmin: string;
  process: string;
  admission: Date;
  location: string;
  stage: string;
  processState: string;
  court: string;
  book: string;
  status?: string;
  visibility?: boolean;
  movementsHistory: Movement[];
  litigants: Litigant[];
}

export interface Movement {
  invoice: string;
  document: string[];
  stage: string;
  procedure: string;
  descProcedure: string;
  dateProcedure: Date;
  page: number;
}

export interface Litigant {
  participant: string;
  rut: string;
  person: string;
  name: string;
}

const MovementSchema = new Schema<Movement>({
  invoice: { type: String },
  document: { type: [String] },
  stage: { type: String },
  procedure: { type: String },
  descProcedure: { type: String },
  dateProcedure: { type: Date },
  page: { type: Number },
});

const LitigantSchema = new Schema<Litigant>({
  participant: { type: String },
  rut: { type: String },
  person: { type: String },
  name: { type: String },
});

const CauseCivilSchema = new Schema<CauseCivilPrimitives>(
  {
    rol: { type: String },
    cover: { type: String },
    estAdmin: { type: String },
    process: { type: String },
    admission: { type: Date },
    location: { type: String },
    stage: { type: String },
    processState: { type: String },
    court: { type: String },
    book: { type: String },
    status: { type: String, default: "ACTIVE" },
    visibility: { type: Boolean, default: false },
    movementsHistory: { type: [MovementSchema], required: true },
    litigants: { type: [LitigantSchema], required: true },
  },
  {
    timestamps: true,
  }
);

export const CauseCivil = mongoose.model<CauseCivilPrimitives>(
  "CauseCivil",
  CauseCivilSchema
);
