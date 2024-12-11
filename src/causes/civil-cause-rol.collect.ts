import { CauseCivil } from "../db";
import { ccaseDocumentUpdater } from "../db/ccause-updater";
import { FileSystemService, ScrapService } from "../plugins";
import { CivilCauseDetail } from "./civil-cause.detail";
import {
  Anchor,
  CauseCivilPrimitives,
  Documentation,
  Litigant,
  Movement,
} from "./civil-cause.types";
import { CivilCauseExtractFailed } from "./civil-extract-doc.failed";
import { HistoryScrape } from "./helpers/history-scrape";
import { parseStringToCode } from "./parse-string";

export class CivilCauseRolCollectScrape {
  private anchors: Array<Anchor> = [];
  private civils: Omit<
    CauseCivilPrimitives,
    "movementsHistory" | "litigants"
  >[] = [];
  private histories: Movement[] = [];
  private litigants: Litigant[] = [];
  private causePersist: CauseCivilPrimitives | null = null;
  public hasUpdate: boolean = false;
  private causeTemp: string = "";
  private failedDocs: Documentation[] = [];
  public annex: string[] = [];

  constructor(
    private readonly scrap: ScrapService,
    private readonly file: FileSystemService
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

  async applyRolFilter(cause: string): Promise<void> {
    this.causeTemp = cause;
    const query = await CauseCivil.findOne({ rol: cause });

    if (query) {
      this.causePersist = CivilCauseDetail.create(query);
      console.log(`Cause civil by rol: ${cause}`);
      console.log(this.causePersist);
    }

    const params = cause.split("-");
    await this.page.evaluate(([rit, rol, year]) => {
      const statusSelect = document.querySelector<HTMLSelectElement>(
        "#estadoCausaMisCauCiv"
      );
      if (statusSelect) {
        statusSelect.value = "1";
      }

      const ritElement = document.querySelector<HTMLSelectElement>(
        "select#tipoMisCauCiv"
      );

      const rolElement =
        document.querySelector<HTMLInputElement>("input#rolMisCauCiv");

      const yearElement = document.querySelector<HTMLInputElement>(
        "input#anhoMisCauCiv"
      );

      if (ritElement && rolElement && yearElement) {
        ritElement.value = rit;
        rolElement.value = rol;
        yearElement.value = year;
      }

      const search = document.querySelector<HTMLButtonElement>(
        "#btnConsultaMisCauCiv"
      );
      search?.click();
    }, params);
    console.log("Filters applied");
    return this.scrap.timeout(1500);
  }

  async collectCauses() {
    try {
      await this.scrap.waitForSelector("tbody#verDetalleMisCauCiv", 3000);
      await this.scrap.waitForSelector("div.loadTotalCiv");
      await this.scrap.simuleBodyAction();

      await this.collectAnchors();
      console.log(`Total anchors collected: ${this.anchors.length}`);
    } catch (error) {
      console.error("Error collecting causes:", error);
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
        await this.scrap.execute(anchor.script);
        await this.scrap.timeout(1500);

        const { book, ...causeDetails } = await this.extractCauseDetails();

        const movementsHistory = await this.extractMovementsHistory();
        await this.scrap.timeout(1000);
        console.log("Book: ", book);
        const movements = movementsHistory.map((item) => ({
          ...item,
          book,
        }));
        const litigants = await this.extractLitigants();

        this.civils.push(causeDetails);
        this.histories.push(...movements);
        litigants.map((l) => this.addLitigantIfNotExists(l));
        // this.litigants.push(...litigants);

        console.table(causeDetails);
        console.log(movementsHistory.length);
        console.table(litigants);

        await this.closeModal();
        await this.scrap.timeout(2000);
      }

      await this.hasChanges();
    } catch (error) {
      console.error("Error collecting details:", error);
      throw error;
    }
  }

  private async hasChanges() {
    try {
      let flag = false;

      if (
        !this.hasChangesMovements(this.histories) &&
        !this.hasChangesLitigants(this.litigants)
      ) {
        flag = true;
        console.log("There are no changes in the rol cause");
      } else if (this.causePersist) {
        this.hasUpdate = true;
      }

      if (flag) {
        await this.finish();
        return process.exit();
      }
    } catch (error) {
      console.error("Error validating if there are changes in the role");
      throw error;
    }
  }

  public getCauseCivil(): CauseCivilPrimitives {
    const civilcause = this.civils[0];

    return {
      ...civilcause,
      litigants: this.litigants,
      movementsHistory: this.histories.map((history) => ({
        ...history,
        document: history.document
          .map((_doc, index) => {
            return `${parseStringToCode(history.procedure)}_${parseStringToCode(
              history.descProcedure
            )}_${this.codeUnique(history.dateProcedure)}_${index}.pdf`;
          })
          .concat(this.annex.map((item) => `${item}.pdf`)),
      })),
    };
  }

  private hasChangesMovements(movements: Movement[]): boolean {
    if (!this.causePersist) {
      return true;
    }

    return this.compareMovements(this.causePersist.movementsHistory, movements);
  }
  private hasChangesLitigants(litigants: Litigant[]): boolean {
    if (!this.causePersist) {
      return true;
    }

    return this.compareLitigants(this.causePersist.litigants, litigants);
  }

  private compareLitigants(arr1: Litigant[], arr2: Litigant[]): boolean {
    if (arr1.length !== arr2.length) return true;

    // Ordenar los arreglos por un campo único para asegurar la comparación ordenada
    const sortByRut = (arr: Litigant[]) =>
      arr.slice().sort((a, b) => a.rut.localeCompare(b.rut));

    const sortedArr1 = sortByRut(arr1);
    const sortedArr2 = sortByRut(arr2);

    return sortedArr1.some((litigant1, index) => {
      const litigant2 = sortedArr2[index];

      return (
        litigant1.rut !== litigant2.rut ||
        litigant1.person !== litigant2.person ||
        litigant1.name !== litigant2.name
      );
    });
  }

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

  async collectDocuments(tempURLs?: Documentation[]) {
    const urls = tempURLs || this.getURLs();
    return this.downloadPDF(urls);
  }

  private async downloadPDF(urls: Documentation[]) {
    console.log(`Starting document download for ${urls.length} documents...`);
    await Promise.allSettled(urls.map((doc) => this.extractDocument(doc)));
    console.log("All documents downloaded.");
  }

  private async collectAnchors(): Promise<void> {
    try {
      const anchorsOnPage = await this.page.evaluate(() => {
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
    } catch (error) {
      console.error("Error collecting anchors:", error);
      throw error;
    }
  }

  private async closeModal() {
    return this.page.evaluate(() => {
      const close = document.querySelector<HTMLButtonElement>("button.close");
      close?.click();
    });
  }

  private async extractCauseDetails(): Promise<
    Omit<CauseCivilPrimitives, "movementsHistory" | "litigants"> & {
      book: string;
    }
  > {
    try {
      await this.scrap.waitForSelector(
        'div[style="background-color:#F9F9F9"]',
        5000
      );
      await this.scrap.waitForSelector("select#selCuaderno");

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

  private async extractMovementsHistory(): Promise<Omit<Movement, "book">[]> {
    try {
      await this.scrap.waitForSelector("div#loadHistCuadernoCiv", 5000);

      const historyScrape = new HistoryScrape(this.page, this.causeTemp, "one");

      const annexDocs = await historyScrape.start();

      this.annex.push(...annexDocs);

      const movements = historyScrape.getmovementsHistories();

      return movements;
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
    const filename = `${parseStringToCode(procedure)}_${parseStringToCode(
      descProcedure
    )}_${this.codeUnique(dateProcedure)}_${index}`;

    console.log(`Init extract document: ${filename}.pdf`);
    const pdfArray = await this.extractPDF(url);

    if (!pdfArray) {
      this.failedDocs.push(doc);
      return;
    }

    this.file.writeDocumentByCause(pdfArray, this.causeTemp, filename);
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

  private parseDate(dateString: string): Date {
    const [day, month, year] = dateString
      .split("/")
      .map((item) => Number(item));
    return new Date(year, month - 1, day);
  }

  async finish(): Promise<void> {
    try {
      this.anchors = [];
      if (this.failedDocs.length > 0) {
        await this.collectAnchors();
        const extractDocFailed = new CivilCauseExtractFailed(
          this.failedDocs,
          this.anchors,
          this.scrap
        );
        const docs = await extractDocFailed.getNewsURLs();
        await this.collectDocuments(docs);
      }
    } catch (error) {
      console.error("Error saving causes data:", error);
      throw error;
    } finally {
      await this.scrap.close();
      console.log("Scrap service closed.");
    }
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

  private get page() {
    return this.scrap.getPage();
  }
}
