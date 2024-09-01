import { ScrapService } from "../plugins";
import { FileSystemService } from "../plugins/file.plugin";
import {
  Anchor,
  CauseCivilPrimitives,
  Documentation,
  Litigant,
  Movement,
} from "./civil-cause.types";
import { Pagination } from "./pagination";

export class CivilCauseScrap {
  private readonly anchors: Array<Anchor> = [];
  private readonly causes: Array<CauseCivilPrimitives> = [];

  constructor(
    private readonly scrap: ScrapService,
    private readonly fileService: FileSystemService
  ) {}

  async init(): Promise<void> {
    try {
      await this.scrap.init();
      console.log("Scrap service initialized.");
    } catch (error) {
      console.error("Error initializing scrap service:", error);
      throw error;
    }
  }

  async finish(): Promise<void> {
    try {
      // this.fileService.write(this.causes, new Date().toISOString());
      // console.log("Causes data saved to JSON file.");
    } catch (error) {
      console.error("Error saving causes data:", error);
      throw error;
    } finally {
      await this.scrap.close();
      console.log("Scrap service closed.");
    }
  }

  async navigateToCivilCausesTab(): Promise<void> {
    try {
      await this.scrap.clickElement('a[onclick="misCausas();"]', 3500);
      await this.scrap.clickElement("a#civilTab", 3500);
      await this.scrap.simuleBodyAction();
      console.log("Navigated to civil causes tab.");
    } catch (error) {
      console.error("Error navigating to civil causes tab:", error);
      throw error;
    }
  }

  async applyActiveFilter() {
    await this.page.evaluate(() => {
      const statusSelect = document.querySelector(
        "#estadoCausaMisCauCiv"
      ) as HTMLSelectElement;
      statusSelect.value = "1";

      const inputYear = document.querySelector(
        "input#anhoMisCauCiv"
      ) as HTMLInputElement;

      const inputRol = document.querySelector(
        "input#rolMisCauCiv"
      ) as HTMLInputElement;
      if (inputYear && inputRol) {
        inputYear.value = new Date().getFullYear().toString();
        inputRol.value = "2622";
      }

      const search = document.querySelector(
        "#btnConsultaMisCauCiv"
      ) as HTMLButtonElement;
      search?.click();
    });
    console.log("Filters applied");
    return this.scrap.timeout(1500);
  }

  async collectCauses() {
    try {
      await this.scrap.waitForSelector("tbody#verDetalleMisCauCiv", 3000);
      // await this.scrap.waitForSelector("div.loadTotalCiv", 500);
      await this.scrap.simuleBodyAction();

      const totalItems = await this.getTotalItems();
      const pagination = Pagination.calculate(totalItems);
      const totalPages = pagination.length;
      console.log(`Total items: ${totalItems}, Total pages: ${totalPages}`);

      for (const page of pagination) {
        await this.collectAnchors();
        if (page < totalPages) {
          await this.goToNextPage();
        }
      }
      console.log(`Total anchors collected: ${this.anchors.length}`);
    } catch (error) {
      console.error("Error collecting causes:", error);
      throw error;
    }
  }

  private async goToNextPage(): Promise<void> {
    try {
      await this.page.evaluate(() => {
        const nextButton = document.querySelector<HTMLAnchorElement>("a#sigId");
        nextButton?.click();
      });
      await this.scrap.timeout(3000);
      await this.scrap.waitForSelector("tbody#verDetalleMisCauCiv", 5000);
      console.log("Navigated to next page.");
    } catch (error) {
      console.error("Error navigating to next page:", error);
      throw error;
    }
  }

  private async getTotalItems(): Promise<number> {
    const totalItemsText = await this.page.evaluate(() => {
      return document.querySelector("div.loadTotalCiv>b")?.textContent || "0";
    });
    const totalItems = parseInt(totalItemsText, 10);
    return isNaN(totalItems) ? 0 : totalItems;
  }

  private async collectAnchors(): Promise<void> {
    try {
      const anchorsOnPage = await this.page.evaluate(() => {
        const rows = Array.from(
          document.querySelectorAll("tbody#verDetalleMisCauCiv>tr")
        );
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
    } catch (error) {
      console.error("Error collecting anchors:", error);
      throw error;
    }
  }

  async collectDetails(): Promise<void> {
    try {
      for (const [index, anchor] of this.anchors.entries()) {
        console.log(`Processing cause ${index + 1}/${this.anchors.length}...`);
        await this.scrap.execute(anchor.script);
        await this.scrap.timeout(1500);

        const causeDetails = await this.extractCauseDetails();
        const movementsHistory = await this.extractMovementsHistory();
        const litigants = await this.extractLitigants();
        console.table(causeDetails);
        console.table(movementsHistory);
        console.table(litigants);

        this.causes.push({
          ...causeDetails,
          movementsHistory,
          litigants,
        });

        // await this.closeModal();
        await this.scrap.timeout(2000);
      }
      console.log(`Total causes collected: ${this.causes.length}`);
    } catch (error) {
      console.error("Error collecting details:", error);
      throw error;
    }
  }

  private async extractCauseDetails(): Promise<
    Omit<CauseCivilPrimitives, "movementsHistory" | "litigants">
  > {
    try {
      await this.scrap.waitForSelector(
        'div[style="background-color:#F9F9F9"]',
        5000
      );

      const causeDetails = await this.page.evaluate(() => {
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
        admission: this.parseDate(causeDetails.admission),
      };
    } catch (error) {
      console.error("Error extracting cause details:", error);
      throw error;
    }
  }

  private async extractMovementsHistory(): Promise<Movement[]> {
    try {
      await this.scrap.waitForSelector("div#loadHistCuadernoCiv", 5000);

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
  private async extractLitigants(): Promise<Litigant[]> {
    try {
      await this.page.click('a[href="#litigantesCiv"]');
      await this.scrap.timeout(1500);

      const litigants = await this.page.evaluate(() => {
        const rows = Array.from(
          document.querySelectorAll("div#litigantesCiv table > tbody > tr")
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

  async collectDocuments() {
    const urls = this.getURLs();
    console.log(`Starting document download for ${urls.length} documents...`);
    await Promise.all(urls.map((doc) => this.extractDocument(doc)));
    console.log("All documents downloaded.");
  }

  private async extractDocument(doc: Documentation) {
    const { url } = doc;
    const filename = url.split("?").at(1)?.split(".").at(2) || "";
    console.log(`Init extract document: ${filename}`);
    const pdfArray = await this.extractPDF(url);
    console.log("Document collect: ", filename);
    return this.fileService.save(pdfArray, filename);
  }

  async extractPDF(pdfUrl: string) {
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

    console.log(pdfBuffer?.length || "No PDF buffer received");

    if (!pdfBuffer) {
      console.log("Pdf not extracted");
    }

    return pdfBuffer || [];
  }

  private parseDate(dateString: string): Date {
    const [day, month, year] = dateString.split("/").map(Number);
    return new Date(year, month - 1, day);
  }

  private getURLs(): Documentation[] {
    const documents: Documentation[] = [];

    this.causes.forEach((civil) => {
      civil.movementsHistory.forEach((movement) => {
        movement.document.forEach((url) => {
          documents.push({
            url,
          });
        });
      });
    });

    return documents;
  }

  public getCauses(): CauseCivilPrimitives[] {
    return this.causes.map((cause) => {
      return {
        ...cause,
        movementsHistory: cause.movementsHistory.map((history) => ({
          ...history,
          document: history.document.map((doc) => {
            return `${doc.split("?").at(1)?.split(".").at(2)}.pdf`;
          }),
        })),
      };
    });
  }

  private get page() {
    return this.scrap.getPage();
  }
}
