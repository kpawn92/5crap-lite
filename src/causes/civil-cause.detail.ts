import { Litigant, Movement } from "./civil-cause.types";

type InputType = { [key: string]: any };
export class CivilCauseDetail {
  readonly rol: string;
  readonly cover: string;
  readonly estAdmin: string;
  readonly process: string;
  readonly admission: Date;
  readonly location: string;
  readonly stage: string;
  readonly processState: string;
  readonly court: string;
  readonly book: string;
  readonly status?: string;
  readonly visibility?: boolean;
  readonly movementsHistory: Movement[];
  readonly litigants: Litigant[];

  constructor({
    rol,
    cover,
    estAdmin,
    process,
    admission,
    location,
    stage,
    processState,
    court,
    book,
    status,
    visibility,
    movementsHistory,
    litigants,
  }: InputType) {
    this.rol = rol;
    this.cover = cover;
    this.estAdmin = estAdmin;
    this.process = process;
    this.admission = admission;
    this.location = location;
    this.stage = stage;
    this.processState = processState;
    this.court = court;
    this.book = book;
    this.status = status;
    this.visibility = visibility;
    this.movementsHistory = movementsHistory;
    this.litigants = litigants;
  }

  static create(input: InputType): CivilCauseDetail {
    return new CivilCauseDetail(input);
  }
}
