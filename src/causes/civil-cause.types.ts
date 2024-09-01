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
  book: string;
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

export interface Documentation {
  url: string;
}
