import { Page } from "puppeteer";
import { FileSystemService, ScrapService } from "../../plugins";
import { EventService } from "../../plugins/event-emitir";
import { wait } from "../../plugins/wait";
import {
  Anchor,
  CauseCivilPrimitives,
  Documentation,
  Litigant,
  Movement,
} from "../civil-cause.types";
import { HistoryScrape } from "../helpers/history-scrape";
import { parseStringToCode } from "../parse-string";

export interface FiltersDaily {
  day: number;
  month: number;
  year: number;
}

export type Doc = Documentation & { rol: string };

interface Annex {
  documents: string[];
  cause: string;
}

export class Daily {
  private anchors: Anchor[] = [];
  private civils: CauseCivilPrimitives[] = [];
  private annex: Annex[] = [];

  constructor(
    private readonly scrape: ScrapService,
    private readonly storage: FileSystemService,
    private readonly dispatch: EventService
  ) {}

  async rawData(filters: FiltersDaily) {
    await this.goMyDailyStatus();
    await this.navToTab();
    await this.applyFilter(filters);
    await this.extractAnchors();
    await this.collectDetails();
  }

  async retryProccess(doc: Doc) {
    this.anchors = [];
    this.civils = [];
    await this.extractAnchors();
    await this.collectDetails();
    const documents = this.getURLs();
    await this.collectDocuments(
      documents.find(
        (item) =>
          item.rol === doc.rol &&
          item.procedure === doc.procedure &&
          item.index === doc.index
      )
    );
  }

  private async goMyDailyStatus(otherPage?: Page): Promise<void> {
    try {
      await this.scrape.clickElement(
        'a[onclick="miEstadoDiario();"]',
        3500,
        otherPage
      );
      await this.scrape.simuleBodyAction(otherPage);
      console.log("Navigated to daily status");
    } catch (error) {
      console.error("Error navigating to daily status:", error);
      throw error;
    }
  }
  private async navToTab(otherPage?: Page): Promise<void> {
    try {
      await this.scrape.clickElement('a[href="#estDiaCivil"]', 3500, otherPage);
      console.log("Navigated to tab civil cause");
    } catch (error) {
      console.error("Error navigating to civil causes tab:", error);
      throw error;
    }
  }
  private async applyFilter(options: FiltersDaily) {
    try {
      await this.scrape.waitForSelector("input#fechaEstDiaCiv");

      await this.page.evaluate(({ day, month, year }) => {
        const dateInput = document.querySelector<HTMLInputElement>(
          "input#fechaEstDiaCiv"
        );
        if (dateInput) {
          dateInput.value = `${day}/${month}/${year}`;
        }
        const search = document.querySelector<HTMLButtonElement>(
          "button#btnConsultaEstDiaCivil"
        );

        search?.click();
      }, options);
      await wait(3000);
    } catch (error) {
      console.error("Error apply filters in date:", error);
      throw error;
    }
  }

  private async extractAnchors() {
    await this.scrape.waitForSelector("table#dtaTableDetalleEstDiaCivil", 1500);
    const contentEmpty = "Ningún dato disponible";

    const empty = await this.page.evaluate((content) => {
      return document.body.innerText.includes(content);
    }, contentEmpty);

    if (empty) {
      this.dispatch.emit("anchorsIsEmpty", "No results found...!!!");
    }

    const anchorsOnPage = await this.page.evaluate(() => {
      const table = document.querySelector<HTMLTableElement>(
        "table#dtaTableDetalleEstDiaCivil"
      );
      const rows = Array.from(table?.querySelectorAll("tbody>tr") || []);
      return rows
        .map(
          (row) =>
            row
              .querySelector('a[href="#modalDetalleEstDiaCivil"]')
              ?.getAttribute("onclick") || ""
        )
        .filter((script) => script.length > 0);
    });

    const formattedAnchors = anchorsOnPage.map((script) => ({ script }));
    this.anchors.push(...formattedAnchors);
    console.log(
      `Collected ${formattedAnchors.length} anchors on current page.`
    );
  }

  private async extractCauseDetails(): Promise<
    Omit<CauseCivilPrimitives, "movementsHistory" | "litigants"> & {
      book: string;
    }
  > {
    try {
      this.page.waitForSelector('div[style="background-color:#F9F9F9"]', {
        timeout: 5 * 60 * 1000, // 5min
        visible: true,
      });
      await wait(4000);

      const causeDetails = await this.page.evaluate(() => {
        const getTextContent = (selector: string): string =>
          document.querySelector(selector)?.textContent?.trim() || "";

        const cells = Array.from(
          document.querySelectorAll(
            'div[style="background-color:#F9F9F9"]>table:nth-child(1) td'
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
        admission: this.parseDate(causeDetails.admission),
      };
    } catch (error) {
      console.error("Error extracting cause details:", error);
      throw error;
    }
  }

  private parseDate(dateString: string): Date {
    const [day, month, year] = dateString
      .split(" ")[0]
      .split("/")
      .map((item) => Number(item));

    return new Date(year, month - 1, day);
  }

  async collectDetails(): Promise<void> {
    try {
      if (this.anchors.length === 0) {
        this.dispatch.emit("failedCaptureAnchors", "Not already anchors");
        return;
      }
      for (const [index, anchor] of this.anchors.entries()) {
        console.log(`Processing cause ${index + 1}/${this.anchors.length}...`);
        await this.scrape.execute(anchor.script);
        await wait(3500);

        const { book, ...causeDetails } = await this.extractCauseDetails();
        await wait(1000);
        console.log("Book: ", book);
        console.log("Details: ");
        console.table(causeDetails);

        const movements = await this.extractMovementsHistory(causeDetails.rol);

        const movementsHistory = movements.map((item) => ({
          ...item,
          book,
        }));
        console.log(movementsHistory);
        const litigants = await this.extractLitigants();
        console.log("Litigants: ");
        console.table(litigants);

        this.civils.push({
          ...causeDetails,
          movementsHistory,
          litigants,
        });

        console.log(movementsHistory.length);

        await this.closeModal();
        await wait(2000);
      }
    } catch (error) {
      console.error("Error collecting details:", error);
      throw error;
    }
  }

  async collectDocuments(doc?: Doc) {
    const urls = doc ? [doc] : this.getURLs();
    return this.downloadPDF(urls);
  }

  private async downloadPDF(urls: Doc[]) {
    console.log(`Starting document download for ${urls.length} documents...`);
    await Promise.allSettled(urls.map((doc) => this.extractDocument(doc)));
    console.log("All documents downloaded.");
  }

  private getURLs(): Doc[] {
    const documents: Doc[] = [];

    this.civils.forEach((cause) => {
      cause.movementsHistory.forEach((hisotory) =>
        hisotory.document.forEach((url, index) => {
          documents.push({
            index,
            url,
            dateProcedure: hisotory.dateProcedure,
            descProcedure: hisotory.descProcedure,
            procedure: hisotory.procedure,
            rol: cause.rol,
          });
        })
      );
    });

    return documents;
  }

  private async extractDocument(doc: Doc) {
    const { url, dateProcedure, descProcedure, index, procedure } = doc;
    const filename = `${parseStringToCode(procedure)}_${parseStringToCode(
      descProcedure
    )}_${this.codeUnique(dateProcedure)}_${index}`;

    console.log(`Init extract document: ${filename}.pdf`);
    const pdfArray = await this.extractPDF(url);

    if (!pdfArray) {
      this.dispatch.emit("failedToReceivePDF", doc);
      return;
    }

    this.storage.writeDocumentByCause(pdfArray, doc.rol, filename);
    console.log("Document collect: ", filename);
  }

  private async extractPDF(pdfUrl: string) {
    const pdfBuffer = await this.page.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          console.log("Fetch failed with status:", response.status);
          return null;
        }

        const buffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      } catch (error) {
        console.log("Error fetching PDF:", error);
        return null;
      }
    }, pdfUrl);

    if (!pdfBuffer) {
      console.log("No PDF buffer received");
    }

    return pdfBuffer;
  }

  public getccivils(): CauseCivilPrimitives[] {
    return this.civils.map((cause) => ({
      ...cause,
      movementsHistory: cause.movementsHistory.map(
        ({ document, ...history }) => ({
          ...history,
          document: document
            .map((_doc, idx) => {
              return `${parseStringToCode(
                history.procedure
              )}_${parseStringToCode(history.descProcedure)}_${this.codeUnique(
                history.dateProcedure
              )}_${idx}.pdf`;
            })
            .concat(
              this.annex
                .filter((item) => item.cause === cause.rol)
                .map((item) => item.documents.map((doc) => `${doc}.pdf`))
                .flat()
            ),
        })
      ),
    }));
  }

  private codeUnique(date: Date): string {
    // Obtener la fecha actual
    const year = date.getFullYear().toString().slice(-2); // Últimos dos dígitos del año
    const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Mes con dos dígitos
    const day = date.getDate().toString().padStart(2, "0"); // Día con dos dígitos

    // Generar un número aleatorio de 4 dígitos
    // const randomPart = Math.floor(1000 + Math.random() * 9000).toString();

    const code = `${year}${month}${day}`;

    return code;
  }

  private async extractLitigants(): Promise<Litigant[]> {
    try {
      await this.page.click('a[href="#litigantesCiv"]');
      await wait(1500);

      const litigants = await this.page.evaluate(() => {
        const rows = Array.from(
          document.querySelectorAll("div#litigantesCiv table > tbody > tr") ||
            []
        );

        return rows.map((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
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

  private async extractMovementsHistory(
    cause: string
  ): Promise<Omit<Movement, "book">[]> {
    try {
      await this.scrape.waitForSelector("div#loadHistCuadernoCiv", 5000);
      const historyScrape = new HistoryScrape(this.page, cause, this.storage);

      const annexDocs = await historyScrape.start();

      this.annex.push({
        cause,
        documents: annexDocs,
      });

      const movements = historyScrape.getmovementsHistories();
      return movements;

      // const movements = await this.page.evaluate(() => {
      //   const container = document.querySelector<HTMLDivElement>(
      //     "div#loadHistCuadernoCiv"
      //   );
      //   const table = container?.querySelector("table");

      //   const rows = Array.from(table?.querySelectorAll("tbody>tr") || []);

      //   return rows.map((row) => {
      //     const cells = Array.from(row.querySelectorAll("td"));

      //     const invoice = cells[0]?.textContent?.trim() || "";
      //     const stage = cells[3]?.textContent?.trim() || "";
      //     const procedure = cells[4]?.textContent?.trim() || "";
      //     const descProcedure = cells[5]?.textContent?.trim() || "";
      //     const dateProcedure = cells[6]?.textContent?.trim() || "";
      //     const pageNumber = parseInt(cells[7]?.textContent?.trim() || "0", 10);

      //     const documentForms = Array.from(
      //       cells[1]?.querySelectorAll("form") || []
      //     );
      //     const documents = documentForms.map((form) => {
      //       const action = form.getAttribute("action") || "";
      //       const input = form.querySelector("input");
      //       const queryName = input?.getAttribute("name") || "";
      //       const queryValue = input?.getAttribute("value") || "";
      //       const url = `${action}?${queryName}=${queryValue}`;

      //       return url;
      //     });

      //     return {
      //       invoice,
      //       document: documents,
      //       stage,
      //       procedure,
      //       descProcedure,
      //       dateProcedure,
      //       page: isNaN(pageNumber) ? 0 : pageNumber,
      //     };
      //   });
      // });

      // return movements.map((movement) => ({
      //   ...movement,
      //   dateProcedure: this.parseDate(movement.dateProcedure),
      // }));
    } catch (error) {
      console.error("Error extracting movements history:", error);
      throw error;
    }
  }

  private async closeModal() {
    return this.page.evaluate(() => {
      const close = document.querySelector<HTMLButtonElement>("button.close");
      close?.click();
    });
  }

  private get page() {
    return this.scrape.getPage();
  }
}
