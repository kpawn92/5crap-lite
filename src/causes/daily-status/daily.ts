import EventEmitter from "node:events";
import { FileSystemService, ScrapService } from "../../plugins";
import { wait } from "../../plugins/wait";
import {
  Anchor,
  CauseCivilPrimitives,
  Documentation,
  Litigant,
  Movement,
} from "../civil-cause.types";
import { codeUnique } from "../helpers/code-calc";
import { dateCalc } from "../helpers/date-calc";
import { DocumentAllHelper } from "../helpers/document-all.helper";
import { AnnexReturn } from "../helpers/document-persist.helper";
import { HistoryScrape } from "../helpers/history-scrape";
import { parseStringToCode } from "../parse-string";
import { CauseCivilDocument } from "../../db";

export interface FiltersDaily {
  day: number;
  month: number;
  year: number;
}

export type Doc = Documentation & { rol: string };

export class Daily extends EventEmitter {
  private anchors: Anchor[] = [];
  private civils: CauseCivilPrimitives[] = [];
  private annex: AnnexReturn[] = [];

  constructor(private readonly scrape: ScrapService) {
    super();
    this.on("dailyAnchorsEmpty", (msg) => {
      console.log(msg);
      process.exit();
    });
  }

  async rawData(filters: FiltersDaily) {
    await this.goMyDailyStatus();
    await this.navToTab();
    await this.applyFilter(filters);
    await this.extractAnchors();
    await this.collectDetails();
  }

  private async goMyDailyStatus(): Promise<void> {
    try {
      await this.scrape.clickElement('a[onclick="miEstadoDiario();"]', 3500);
      await this.scrape.simuleBodyAction();
      console.log("Navigated to daily status");
    } catch (error) {
      console.error("Error navigating to daily status:", error);
      throw error;
    }
  }
  private async navToTab(): Promise<void> {
    try {
      await this.scrape.clickElement('a[href="#estDiaCivil"]', 3500);
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
      this.emit("dailyAnchorsEmpty", "No results found...!!!");
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
      await this.page.waitForSelector('div[style="background-color:#F9F9F9"]', {
        timeout: 5 * 60 * 1000, // 5min
        visible: true,
      });
      await wait(4000);

      const causeDetails = await this.page.evaluate(() => {
        const getBook = (): string =>
          Array.from(
            document.querySelectorAll("select#selCuaderno>option") || []
          )[0]?.textContent?.trim() || "";

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
          book: getBook(),
        };
      });

      return {
        ...causeDetails,
        admission: dateCalc(causeDetails.admission),
      };
    } catch (error) {
      console.error("Error extracting cause details:", error);
      throw error;
    }
  }
  async collectDetails(): Promise<void> {
    try {
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
        console.table(
          movementsHistory.map(({ document, ...histories }) => ({
            ...histories,
          }))
        );
        const litigants = await this.extractLitigants();
        console.log("Litigants: ");
        console.table(litigants);

        this.civils.push({
          ...causeDetails,
          movementsHistory,
          litigants,
        });

        await this.closeModal();
        await wait(2000);
      }
    } catch (error) {
      console.error("Error collecting details:", error);
      throw error;
    }
  }
  async collectDocuments() {
    const docAll = new DocumentAllHelper(
      this.URLs.map((item) => this.evaluateDocument(item)),
      "daily"
    );
    await docAll.documentationEvaluate();
  }

  private evaluateDocument = (doc: Doc) => {
    const { url, dateProcedure, descProcedure, index, procedure, rol } = doc;
    const filename = `${parseStringToCode(procedure)}_${parseStringToCode(
      descProcedure
    )}_${codeUnique(dateProcedure)}_${index}`;

    return {
      url,
      cause: rol,
      filename,
    };
  };

  private get URLs(): Doc[] {
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

  public get ccivils(): CauseCivilDocument[] {
    return this.civils.map((cause) => ({
      ...cause,
      movementsHistory: cause.movementsHistory.map(
        ({ document, guid, ...history }) => ({
          ...history,
          document: document.map((_doc, idx) => {
            return {
              name: `${history.procedure} ${history.descProcedure}`,
              file: `${parseStringToCode(
                history.procedure
              )}_${parseStringToCode(history.descProcedure)}_${codeUnique(
                history.dateProcedure
              )}_${idx}.pdf`,
              annexs: this.annex.filter((item) => item.guid === guid),
            };
          }),
        })
      ),
    }));
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
      const historyScrape = new HistoryScrape(this.page, cause, "daily");

      const annexDocs = await historyScrape.start();

      this.annex.push(...annexDocs);

      const movements = historyScrape.getmovementsHistories();
      return movements;
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
