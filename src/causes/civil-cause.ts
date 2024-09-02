type InputType = { [key: string]: any };
export class CivilCause {
  readonly rol: string;
  readonly court: string;
  readonly cover: string;
  readonly admissionAt: Date;
  readonly processBook: string;
  readonly book: string;

  constructor({
    rol,
    court,
    cover,
    admissionAt,
    processBook,
    book,
  }: InputType) {
    this.rol = rol;
    this.court = court;
    this.cover = cover;
    this.admissionAt = admissionAt;
    this.processBook = processBook;
    this.book = book;
  }

  static create(input: InputType): CivilCause {
    return new CivilCause(input);
  }
}
