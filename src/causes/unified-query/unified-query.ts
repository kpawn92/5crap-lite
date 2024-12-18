import { Page } from "puppeteer";
import { CauseCivilDocument } from "../../db";
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
import { HistoryScrape } from "../helpers/history-scrape";
import { parseStringToCode } from "../parse-string";
import { AnnexReturn } from "../helpers/document-persist.helper";
import { DocumentAllHelper } from "../helpers/document-all.helper";
import { Doc } from "../daily-status/daily";
import { dateCalc } from "../helpers/date-calc";

export interface UnifiedFilters {
  court: string | number;
  tribune: string | number;
  rol: string;
}

type CCivil = Omit<CauseCivilPrimitives, "movementsHistory" | "litigants">;

export class UnifiedQuery {
  private readonly anchors: Anchor[] = [];
  private civils: CCivil[] = [];
  private histories: Movement[] = [];
  private litigants: Litigant[] = [];
  private annex: AnnexReturn[] = [];
  private rit: string | null = null;
  constructor(
    private readonly scrape: ScrapService,
    private readonly storage: FileSystemService
  ) {}

  async factory(filters: UnifiedFilters) {
    this.rit = filters.rol;
    await this.init();
    await wait(1000);
    await this.goUnifiedQuery();
    await this.applyFilter(filters);
    await this.extractAnchors();
    await this.collectDetails();
    await this.collectDocuments();
  }

  private async init() {
    console.log("Init unified query...");
    return this.scrape.init();
  }

  private async goUnifiedQuery(otherPage?: Page): Promise<void> {
    try {
      await this.scrape.clickElement(
        'a[onclick="consultaUnificada();"]',
        3500,
        otherPage
      );
      await this.scrape.simuleBodyAction(otherPage);
      console.log("Navigated to search by rit");
    } catch (error) {
      console.error("Error navigating to civil causes tab:", error);
      throw error;
    }
  }

  private async applyFilter(options: UnifiedFilters) {
    const { court, tribune, rol } = options;
    try {
      await this.page.waitForSelector("select#competencia", {
        timeout: 0,
        visible: true,
      });
      await this.page.select("select#competencia", "3");
      await wait(500);

      await this.page.click("select#conCorte", { delay: 1000 });
      await this.page.select("select#conCorte", court.toString());
      await wait(500);

      await this.page.click("select#conTribunal", { delay: 1000 });
      await this.page.select("select#conTribunal", tribune.toString());
      await wait(500);

      const [type, ...paramsRol] = rol.split("-");
      await this.page.select("select#conTipoCausa", type);
      await wait(1000);

      await this.page.evaluate(([role, year]) => {
        const rolInput =
          document.querySelector<HTMLInputElement>("input#conRolCausa");
        const yearInput =
          document.querySelector<HTMLInputElement>("input#conEraCausa");
        const searchBtn = document.querySelector<HTMLButtonElement>(
          "button#btnConConsulta"
        );

        if (rolInput && yearInput) {
          rolInput.value = role;
          yearInput.value = year;
          searchBtn?.click();
        }
      }, paramsRol);

      console.log("Filter applied...");
    } catch (error) {
      console.error("Error apply filters:", error);
      throw error;
    }
  }

  private async extractAnchors() {
    await this.scrape.waitForSelector("tbody#verDetalle", 1500);
    const text = "No se han encontrado resultados";

    const empty = await this.page.evaluate((text) => {
      return document.body.innerText.includes(text);
    }, text);

    if (empty) {
      console.log("No results found...!!!");
      return process.exit();
    }

    const anchorsOnPage = await this.page.evaluate(() => {
      const rows =
        Array.from(document.querySelectorAll("tbody#verDetalle>tr")) || [];
      return rows
        .map(
          (row) =>
            row
              .querySelector('a[href="#modalDetalleCivil"]')
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
      const causeDetails = await this.page.evaluate(() => {
        const getTextContent = (selector: string): string =>
          document.querySelector(selector)?.textContent?.trim() || "";

        const cells = Array.from(
          document.querySelectorAll(
            "div.modal-body>div.with-nav-tabs>div.panel-default>table:nth-child(1) td"
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
        admission: dateCalc(causeDetails.admission),
      };
    } catch (error) {
      console.error("Error extracting cause details:", error);
      throw error;
    }
  }

  async collectDetails(): Promise<void> {
    try {
      if (this.anchors.length === 0) {
        console.log("Process finish: There are no civil cases to download");
        return process.exit();
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

        const movementsHistory = await this.extractMovementsHistory(
          causeDetails.rol
        );

        const movements = movementsHistory.map((item) => ({
          ...item,
          book,
        }));
        console.log(movements);
        const litigants = await this.extractLitigants();
        console.log("Litigants: ");
        console.table(litigants);

        this.civils.push(causeDetails);
        this.histories.push(...movements);
        this.litigants.push(...litigants);

        console.log(movementsHistory.length);

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

    this.histories.forEach((movement) => {
      movement.document.forEach((url, index) => {
        documents.push({
          index,
          url,
          dateProcedure: movement.dateProcedure,
          descProcedure: movement.descProcedure,
          procedure: movement.procedure,
          rol: this.civils[0].rol,
        });
      });
    });

    return documents;
  }
  public getccivil(): CauseCivilDocument {
    const civilcause = this.civils[0];

    return {
      ...civilcause,
      litigants: this.litigants,
      movementsHistory: this.histories.map(
        ({ guid, document, ...history }) => ({
          ...history,
          document: document.map((_doc, index) => {
            return {
              file: `${parseStringToCode(
                history.procedure
              )}_${parseStringToCode(history.descProcedure)}_${codeUnique(
                history.dateProcedure
              )}_${index}.pdf`,
              name: `${history.procedure} ${history.descProcedure}`,
              annexs: this.annex.filter((item) => item.guid === guid),
            };
          }),
        })
      ),
    };
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
      const historyScrape = new HistoryScrape(this.page, cause, "one");

      const annexDocs = await historyScrape.start();

      this.annex.push(...annexDocs);

      return historyScrape.getmovementsHistories();
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
