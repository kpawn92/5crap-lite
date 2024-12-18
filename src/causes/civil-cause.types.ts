export interface Anchor {
  script: string;
}

export interface CauseCivilPrimitives {
  rol: string;
  cover: string;
  estAdmin: string;
  process: string;
  admission: Date;
  location: string;
  stage: string;
  processState: string;
  court: string;
  movementsHistory: Movement[];
  litigants: Litigant[];
}

export interface Movement {
  guid: string;
  invoice: string;
  document: string[];
  stage: string;
  book: string;
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

export type Documentation = Pick<
  Movement,
  "procedure" | "descProcedure" | "dateProcedure"
> & {
  index: number;
  url: string;
};
