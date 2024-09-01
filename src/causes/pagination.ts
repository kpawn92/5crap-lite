export class Pagination {
  private readonly itemsPerPage = 15;

  constructor(private readonly totalItem: number) {}

  private get pagesLength(): number {
    return Math.ceil(this.totalItem / this.itemsPerPage);
  }

  generate(): number[] {
    const totalPages = this.pagesLength;
    const pages: number[] = [];

    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

    return pages;
  }

  static calculate(total: number): number[] {
    return new Pagination(total).generate();
  }
}
