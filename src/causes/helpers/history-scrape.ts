import { Browser, Page } from "puppeteer";
import { Movement } from "../civil-cause.types";
import { dateCalc } from "./date-calc";
import { wait } from "../../plugins/wait";
import { DocumentAnnexPersistHelper } from "./document-persist.helper";
import { FileSystemService } from "../../plugins";

type MovementHistory = Omit<Movement, "book">;
type Folder = Pick<Movement, "procedure" | "descProcedure"> & {
  script: string;
};

export interface AnexRequest {
  document: string;
  date: Date;
  reference: string;
  procedure: string;
  descProcedure: string;
}

type CallbackExtend = (page: Page) => Promise<void>;

export class HistoryScrape {
  private histories: MovementHistory[] = [];
  private folders: Folder[] = [];
  private anexs: AnexRequest[] = [];

  constructor(
    private readonly page: Page,
    private readonly browser: Browser,
    private readonly cause: string,
    private readonly storage: FileSystemService
  ) {}

  getmovementsHistories() {
    return this.histories;
  }

  async start(cb: CallbackExtend) {
    const movements = await this.page.evaluate(() => {
      const container = document.querySelector<HTMLDivElement>(
        "div#loadHistCuadernoCiv"
      );
      const table = container?.querySelector("table");
      const rows = Array.from(table?.querySelectorAll("tbody>tr") || []);

      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));

        const invoice = cells[0]?.textContent?.trim() || "";

        const folder =
          cells[2].querySelector("a")?.getAttribute("onclick") || "";

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
          folder: folder,
        };
      });
    });

    this.histories.push(
      ...movements.map((item) => ({
        dateProcedure: dateCalc(item.dateProcedure),
        descProcedure: item.descProcedure,
        document: item.document,
        invoice: item.invoice,
        page: item.page,
        procedure: item.procedure,
        stage: item.stage,
      }))
    );

    this.folders.push(
      ...movements
        .filter((item) => item.folder.length > 0)
        .map((item) => ({
          descProcedure: item.descProcedure,
          procedure: item.procedure,
          script: item.folder,
        }))
    );

    if (this.folders.length === 0) return [];

    const context = await this.folderExtract(cb);

    const persist = new DocumentAnnexPersistHelper(
      this.cause,
      this.storage,
      context,
      this.anexs
    );

    const docs = await persist.annexsEvaluate();
    return docs;
  }

  private async folderExtract(cb: CallbackExtend) {
    const currentUrl = this.page.url();
    const newPage = await this.browser.newPage();

    await newPage.goto(currentUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15 * 60 * 1000, // 15min wait
    });

    await cb(newPage);

    for (const folder of this.folders) {
      this.anexs.push(...(await this.rawDataFolder(newPage, folder)));
    }

    return newPage;
  }

  private async rawDataFolder(
    page: Page,
    folder: Folder
  ): Promise<AnexRequest[]> {
    await page.waitForSelector("#modalAnexoSolicitudCivil .modal-body table", {
      timeout: 0,
    });
    await page.evaluate((script) => {
      eval(script);
    }, folder.script);
    await wait(4000);

    const result = await page.$$eval(
      "#modalAnexoSolicitudCivil .modal-body table tbody tr",
      (rows) => {
        return rows.map((row) => {
          // Obtén todos los celdas (td) de la fila
          const cells = row.querySelectorAll("td");
          // Obtén el valor del token del input hidden
          const form = row.querySelector("form");
          const action = form?.getAttribute("action") || "";
          const input = form?.querySelector("input");
          const queryName = input?.getAttribute("name") || "";
          const queryValue = input?.getAttribute("value") || "";
          const url = `${action}?${queryName}=${queryValue}`;

          return {
            document: url,
            date: dateCalc(cells[1]?.textContent?.trim() || ""),
            reference: cells[2]?.textContent?.trim() || "",
          };
        });
      }
    );

    //--> Close modal
    await page.click('button[data-dismiss="modal"]', { delay: 1000 });

    return result.map((item) => ({
      date: item.date,
      descProcedure: folder.descProcedure,
      document: item.document,
      procedure: folder.procedure,
      reference: item.reference,
    }));
  }
}
