import mongoose, { Schema } from "mongoose";

export interface CauseCivilDocument {
  rol: string;
  cover: string;
  estAdmin: string;
  process: string;
  admission: Date;
  location: string;
  stage: string;
  processState: string;
  court: string;
  status?: string;
  visibility?: boolean;
  movementsHistory: Movement[];
  litigants: Litigant[];
}

interface Annex {
  reference: string;
  date: Date;
  file: string;
}

interface Doc {
  name: string;
  file: string;
  annexs: Annex[];
}

export interface Movement {
  invoice: string;
  document: Doc[];
  stage: string;
  procedure: string;
  book: string;
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

const AnnexSchema = new Schema<Annex>({
  reference: { type: String },
  file: { type: String },
  date: { type: Date },
});

const DocSchema = new Schema<Doc>({
  name: { type: String },
  file: { type: String },
  annexs: { type: [AnnexSchema], required: true },
});

const MovementSchema = new Schema<Movement>({
  invoice: { type: String },
  document: { type: [DocSchema], required: true },
  stage: { type: String },
  procedure: { type: String },
  book: { type: String },
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

const CauseCivilSchema = new Schema<CauseCivilDocument>(
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
    status: { type: String, default: "ACTIVE" },
    visibility: { type: Boolean, default: false },
    movementsHistory: { type: [MovementSchema], required: true },
    litigants: { type: [LitigantSchema], required: true },
  },
  {
    timestamps: true,
  }
);

export const CauseCivil = mongoose.model<CauseCivilDocument>(
  "CauseCivil",
  CauseCivilSchema
);

export const CauseCivilUpdater = mongoose.model<CauseCivilDocument>(
  "CauseCivilUpdater",
  CauseCivilSchema
);
