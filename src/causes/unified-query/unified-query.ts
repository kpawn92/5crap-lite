import { FileSystemService, ScrapService } from "../../plugins";
import { wait } from "../../plugins/wait";
import {
  Anchor,
  CauseCivilPrimitives,
  Documentation,
  Litigant,
  Movement,
} from "../civil-cause.types";

export interface UnifiedFilters {
  court: string;
  tribune: string;
  rol: string;
}

type CCivil = Omit<CauseCivilPrimitives, "movementsHistory" | "litigants">;

export class UnifiedQuery {
  private readonly anchors: Anchor[] = [];
  private civils: CCivil[] = [];
  private histories: Movement[] = [];
  private litigants: Litigant[] = [];
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

  private async goUnifiedQuery(): Promise<void> {
    try {
      await this.scrape.clickElement('a[onclick="consultaUnificada();"]', 3500);
      await this.scrape.simuleBodyAction();
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
      await this.page.select("select#competencia", "3"); // Select civil static
      await wait(500);

      await this.page.click("select#conCorte", { delay: 1000 });
      const cortOptions = await this.page.evaluate(() => {
        const cortSelect =
          document.querySelector<HTMLSelectElement>("select#conCorte");
        const options = Array.from(
          cortSelect?.querySelectorAll("option") || []
        );

        return options.map((item) => ({
          value: item.value,
          label: item.textContent?.trim() || "",
        }));
      });
      console.table(cortOptions);
      const cortOption = cortOptions.find((item) =>
        item.label.toLowerCase().includes(court.toLowerCase())
      );
      if (cortOption) {
        console.log(cortOption);
        await this.page.select("select#conCorte", cortOption.value);
        await wait(1000);
      }

      await this.page.click("select#conTribunal", { delay: 1000 });
      const tribunalOptions = await this.page.evaluate(() => {
        const cortSelect =
          document.querySelector<HTMLSelectElement>("select#conTribunal");
        const options = Array.from(
          cortSelect?.querySelectorAll("option") || []
        );

        return options.map((item) => ({
          value: item.value,
          label: item.textContent?.trim() || "",
        }));
      });
      console.table(tribunalOptions);
      const tribuneOption = tribunalOptions.find((item) =>
        item.label.toLowerCase().includes(tribune.toLowerCase())
      );
      if (tribuneOption) {
        console.log(tribuneOption);
        await this.page.select("select#conTribunal", tribuneOption.value);
        await wait(1000);
      }

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

        const movementsHistory = await this.extractMovementsHistory();

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
    const urls = this.getURLs();
    return this.downloadPDF(urls);
  }

  private async downloadPDF(urls: Documentation[]) {
    console.log(`Starting document download for ${urls.length} documents...`);
    await Promise.allSettled(urls.map((doc) => this.extractDocument(doc)));
    console.log("All documents downloaded.");
  }

  private getURLs(): Documentation[] {
    const documents: Documentation[] = [];

    this.histories.forEach((movement) => {
      movement.document.forEach((url, index) => {
        documents.push({
          index,
          url,
          dateProcedure: movement.dateProcedure,
          descProcedure: movement.descProcedure,
          procedure: movement.procedure,
        });
      });
    });

    return documents;
  }

  private async extractDocument(doc: Documentation) {
    const { url, dateProcedure, descProcedure, index, procedure } = doc;
    const filename = `${this.parseStringToCode(
      procedure
    )}_${this.parseStringToCode(descProcedure)}_${this.codeUnique(
      dateProcedure
    )}_[${index}]`;

    console.log(`Init extract document: ${filename}.pdf`);
    const pdfArray = await this.extractPDF(url);

    if (!pdfArray) {
      // this.failedDocs.push(doc);
      return;
    }

    this.storage.writeDocumentByCause(
      pdfArray,
      this.rit || "not-rit",
      filename
    );
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

  public getccivil(): CauseCivilPrimitives {
    const civilcause = this.civils[0];

    return {
      ...civilcause,
      litigants: this.litigants,
      movementsHistory: this.histories.map((history) => ({
        ...history,
        document: history.document.map((doc, index) => {
          return `${this.parseStringToCode(
            history.procedure
          )}_${this.parseStringToCode(history.descProcedure)}_${this.codeUnique(
            history.dateProcedure
          )}_${index}.pdf`;
        }),
      })),
    };
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

  private parseStringToCode(value: string): string {
    const chars = value
      .trim()
      .toLowerCase()
      .replaceAll("á", "a")
      .replaceAll("é", "e")
      .replaceAll("í", "i")
      .replaceAll("ó", "o")
      .replaceAll("ú", "u")
      .replaceAll("ñ", "n")
      .replaceAll("|", "_")
      .replaceAll("/", "_")
      .replaceAll('"', "_")
      .replaceAll("'", "_")
      .replaceAll("`", "_")
      .replaceAll(":", "_")
      .replaceAll("\\", "_")
      .split(" ");
    return chars.join("_");
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

  private async extractMovementsHistory(): Promise<Omit<Movement, "book">[]> {
    try {
      await this.scrape.waitForSelector("div#loadHistCuadernoCiv", 5000);

      const movements = await this.page.evaluate(() => {
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
        dateProcedure: this.parseDate(movement.dateProcedure),
      }));
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
