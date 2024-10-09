import { codeUnique } from "../../tools/code-unique";
import { parseDate } from "../../tools/parse-date";
import { parseStringToCode } from "../../tools/parse-string";
import { Scrape } from "../../tools/scrape";
import { timeout } from "../../tools/timeout";
import { CCDetail } from "./detail";

export interface CivilDetail {
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

export interface Anchor {
  script: string;
}

type Detail = Omit<CivilDetail, "movementsHistory" | "litigants">;

type Callback = (
  docs: Documentation[],
  instance: CivilRolDetail
) => Promise<void>;

export class CivilRolDetail {
  private anchors: Anchor[] = [];
  private detail: Detail[] = [];
  private histories: Movement[] = [];
  private litigants: Litigant[] = [];
  public replace: boolean = false;

  constructor(
    private readonly scrape: Scrape,
    private readonly record?: CCDetail
  ) {}

  async rawData(cb: Callback) {
    try {
      await this.scrape.waitForSelector("tbody#verDetalleMisCauCiv", 3000);
      await this.scrape.waitForSelector("div.loadTotalCiv");
      await this.scrape.simuleBodyAction();

      await this.collectAnchors();
      await this.collectDetail();

      await cb(this.getURLs(), this);

      return this.getDetail();
    } catch (error) {
      console.log("Error collect anchors");
      throw error;
    }
  }

  async collectAnchors() {
    this.anchors = [];
    try {
      const anchorsOnPage = await this.scrape.page.evaluate(() => {
        const rows =
          Array.from(
            document.querySelectorAll("tbody#verDetalleMisCauCiv>tr")
          ) || [];
        return rows
          .map(
            (row) =>
              row
                .querySelector('a[href="#modalAnexoCausaCivil"]')
                ?.getAttribute("onclick") || ""
          )
          .filter((script) => script.length > 0);
      });

      const formattedAnchors = anchorsOnPage.map((script) => ({ script }));
      this.anchors.push(...formattedAnchors);
      console.log(
        `Collected ${formattedAnchors.length} anchors on current page.`
      );
      return this.anchors;
    } catch (error) {
      console.log("Error collect anchors");
      throw error;
    }
  }

  private async collectDetail() {
    try {
      if (this.anchors.length === 0) {
        console.log("Process finish: There are no civil cases to download");
        return process.exit();
      }
      for (const [index, anchor] of this.anchors.entries()) {
        console.log(`Processing cause ${index + 1}/${this.anchors.length}...`);
        await this.scrape.execute(anchor.script);
        await timeout(1500);

        const { book, ...causeDetails } = await this.extractCauseDetails();

        const movementsHistory = await this.extractMovementsHistory();
        await timeout(1000);
        console.log("Book: ", book);
        const movements = movementsHistory.map((item) => ({
          ...item,
          book,
        }));
        const litigants = await this.extractLitigants();

        this.detail.push(causeDetails);
        this.histories.push(...movements);
        litigants.map((litigant) => this.addLitigantIfNotExists(litigant));

        console.table(causeDetails);
        console.log(movementsHistory.length);
        console.table(litigants);

        await this.closeModal();
        await timeout(2000);
      }

      !this.hasChangesMovements(this.histories) && (this.replace = true);
    } catch (error) {
      console.error("Error collecting details:", error);
      throw error;
    }
  }

  getDetail(): CivilDetail {
    const civilcause = this.detail[0];

    return {
      ...civilcause,
      litigants: this.litigants,
      movementsHistory: this.histories.map((history) => ({
        ...history,
        document: history.document.map((doc, index) => {
          return this.genName({
            dateProcedure: history.dateProcedure,
            descProcedure: history.descProcedure,
            procedure: history.procedure,
            index,
          });
        }),
      })),
    };
  }

  private getURLs(): Documentation[] {
    const documents: Documentation[] = [];

    this.histories.forEach(
      ({ dateProcedure, descProcedure, procedure, document }) => {
        document.forEach((url, index) => {
          documents.push({
            index,
            url,
            dateProcedure,
            descProcedure,
            procedure,
          });
        });
      }
    );

    return documents;
  }

  private genName(history: {
    procedure: string;
    descProcedure: string;
    dateProcedure: Date;
    index: number;
  }): string {
    return `${parseStringToCode(history.procedure)}_${parseStringToCode(
      history.descProcedure
    )}_${codeUnique(history.dateProcedure)}_[${history.index}].pdf`;
  }

  private hasChangesMovements(movements: Movement[]): boolean {
    if (!this.record) {
      return true;
    }

    return this.compareMovements(this.record.movementsHistory, movements);
  }

  //   private hasChangesLitigants(litigants: Litigant[]): boolean {
  //     if (!this.record) {
  //       return true;
  //     }

  //     return this.compareLitigants(this.record.litigants, litigants);
  //   }

  //   private compareLitigants(arr1: Litigant[], arr2: Litigant[]): boolean {
  //     if (arr1.length !== arr2.length) return true;

  //     // Ordenar los arreglos por un campo único para asegurar la comparación ordenada
  //     const sortByRut = (arr: Litigant[]) =>
  //       arr.slice().sort((a, b) => a.rut.localeCompare(b.rut));

  //     const sortedArr1 = sortByRut(arr1);
  //     const sortedArr2 = sortByRut(arr2);

  //     return sortedArr1.some((litigant1, index) => {
  //       const litigant2 = sortedArr2[index];

  //       return (
  //         litigant1.rut !== litigant2.rut ||
  //         litigant1.person !== litigant2.person ||
  //         litigant1.name !== litigant2.name
  //       );
  //     });
  //   }

  private compareMovements(arr1: Movement[], arr2: Movement[]): boolean {
    if (arr1.length !== arr2.length) return true;

    return arr1.some((movement1, index) => {
      const movement2 = arr2[index];

      return (
        movement1.invoice !== movement2.invoice ||
        movement1.stage !== movement2.stage ||
        movement1.procedure !== movement2.procedure ||
        movement1.descProcedure !== movement2.descProcedure ||
        movement1.dateProcedure.getTime() !==
          movement2.dateProcedure.getTime() ||
        movement1.page !== movement2.page
      );
    });
  }

  private async closeModal() {
    return this.scrape.page.evaluate(() => {
      const close = document.querySelector<HTMLButtonElement>("button.close");
      close?.click();
    });
  }

  private addLitigantIfNotExists(newLitigant: Litigant) {
    // Verificamos si el litigante ya existe en el array comparando todas las propiedades relevantes
    const exists = this.litigants.some(
      (litigant) =>
        litigant.participant === newLitigant.participant &&
        litigant.rut === newLitigant.rut &&
        litigant.person === newLitigant.person &&
        litigant.name === newLitigant.name
    );

    // Si no existe, lo agregamos al array
    if (!exists) {
      this.litigants.push(newLitigant);
      console.log("Litigant add");
    } else {
      console.log("Litigant already exists");
    }
  }

  private async extractMovementsHistory(): Promise<Omit<Movement, "book">[]> {
    try {
      await this.scrape.waitForSelector("div#loadHistCuadernoCiv", 5000);

      const movements = await this.scrape.page.evaluate(() => {
        const container = document.querySelector<HTMLDivElement>(
          "div#loadHistCuadernoCiv"
        );
        const table = container?.querySelector("table");

        const rows = Array.from(table?.querySelectorAll("tbody>tr") || []);

        return rows.map((row) => {
          const cells = Array.from(row.querySelectorAll("td"));

          const invoice = cells[0]?.textContent?.trim() || "";
          const stage = cells[3]?.textContent?.trim() || "";
          const procedure = cells[4]?.textContent?.trim() || "";
          const descProcedure = cells[5]?.textContent?.trim() || "";
          const dateProcedure = cells[6]?.textContent?.trim() || "";
          const pageNumber = parseInt(cells[7]?.textContent?.trim() || "0", 10);

          const documentForms = Array.from(
            cells[1]?.querySelectorAll("form") || []
          );
          const documents = documentForms.map((form) => {
            const action = form.getAttribute("action") || "";
            const input = form.querySelector("input");
            const queryName = input?.getAttribute("name") || "";
            const queryValue = input?.getAttribute("value") || "";
            const url = `${action}?${queryName}=${queryValue}`;

            return url;
          });

          return {
            invoice,
            document: documents,
            stage,
            procedure,
            descProcedure,
            dateProcedure,
            page: isNaN(pageNumber) ? 0 : pageNumber,
          };
        });
      });

      return movements.map((movement) => ({
        ...movement,
        dateProcedure: parseDate(movement.dateProcedure),
      }));
    } catch (error) {
      console.error("Error extracting movements history:", error);
      throw error;
    }
  }

  private async extractCauseDetails(): Promise<
    Omit<CivilDetail, "movementsHistory" | "litigants"> & {
      book: string;
    }
  > {
    try {
      await this.scrape.waitForSelector(
        'div[style="background-color:#F9F9F9"]',
        5000
      );
      await this.scrape.waitForSelector("select#selCuaderno");

      const causeDetails = await this.scrape.page.evaluate(() => {
        const getTextContent = (selector: string): string =>
          document.querySelector(selector)?.textContent?.trim() || "";

        const cells = Array.from(
          document.querySelectorAll(
            'div[style="background-color:#F9F9F9"] > table:nth-child(1) td'
          )
        ).map((cell) => cell.textContent?.trim() || "");

        return {
          rol: cells[0]?.replace("ROL:", "").trim() || "",
          admission: cells[1]?.replace("F. Ing.:", "").trim() || "",
          cover: cells[2]?.trim() || "",
          estAdmin: cells[3]?.replace("Est. Adm.:", "").trim() || "",
          process: cells[4]?.replace("Proc.:", "").trim() || "",
          location: cells[5]?.replace("Ubicación:", "").trim() || "",
          processState: cells[6]?.replace("Estado Proc.:", "").trim() || "",
          stage: cells[7]?.replace("Etapa:", "").trim() || "",
          court: cells[8]?.replace("Tribunal:", "").trim() || "",
          book: getTextContent("select#selCuaderno>option[selected]"),
        };
      });

      return {
        ...causeDetails,
        admission: parseDate(causeDetails.admission),
      };
    } catch (error) {
      console.error("Error extracting cause details:", error);
      throw error;
    }
  }

  private async extractLitigants(): Promise<Litigant[]> {
    try {
      await this.scrape.page.click('a[href="#litigantesCiv"]');
      await timeout(1500);

      const litigants = await this.scrape.page.evaluate(() => {
        const rows = Array.from(
          document.querySelectorAll("div#litigantesCiv table > tbody > tr") ||
            []
        );

        return rows.map((row) => {
          const cells = Array.from(row.querySelectorAll("td") || []);
          return {
            participant: cells[0]?.textContent?.trim() || "",
            rut: cells[1]?.textContent?.trim() || "",
            person: cells[2]?.textContent?.trim() || "",
            name: cells[3]?.textContent?.trim() || "",
          };
        });
      });

      return litigants;
    } catch (error) {
      console.error("Error extracting litigants:", error);
      throw error;
    }
  }
}
