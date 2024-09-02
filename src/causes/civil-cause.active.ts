import { CivilCauseActive } from "../db";
import { ScrapService } from "../plugins";
import { CivilCause } from "./civil-cause";
import { Pagination } from "./pagination";

interface CivilCauseActive {
  rol: string;
  court: string;
  cover: string;
  admissionAt: Date;
  processBook: string;
  book: string;
}

export class CivilCauseActiveScrape {
  private readonly civils: CivilCauseActive[] = [];
  private civilMostRecent?: CivilCause;

  constructor(private readonly scrap: ScrapService) {}

  async init(): Promise<void> {
    try {
      const mostRecent = await CivilCauseActive.findOne().sort({
        admadmissionAt: -1,
      });
      this.civilMostRecent = mostRecent
        ? CivilCause.create(mostRecent)
        : undefined;

      if (this.civilMostRecent) {
        console.log("Civil most recent: ");
        console.table(this.civilMostRecent);
      }

      await this.scrap.init();
      console.log("Capture of active civil cases initialized");
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

  async applyActiveFilter() {
    await this.page.evaluate(() => {
      const statusSelect = document.querySelector<HTMLSelectElement>(
        "#estadoCausaMisCauCiv"
      );
      if (statusSelect) {
        statusSelect.value = "1";
      }

      const search = document.querySelector<HTMLButtonElement>(
        "#btnConsultaMisCauCiv"
      );
      search?.click();
    });
    console.log("Filters cuases active applied");
    return this.scrap.timeout(1500);
  }

  async collectCauses(): Promise<void> {
    try {
      await this.scrap.waitForSelector("tbody#verDetalleMisCauCiv", 3000);
      await this.scrap.waitForSelector("div.loadTotalCiv");
      await this.scrap.simuleBodyAction();

      const totalItems = await this.getTotalItems();
      const pagination = Pagination.calculate(totalItems);
      const totalPages = pagination.length;
      console.log(`Total items: ${totalItems}, Total pages: ${totalPages}`);

      for (const page of pagination) {
        const rols = await this.collectRit();
        console.table(rols);
        const isContinue = this.continueWithScrap(rols);
        if (!isContinue) {
          console.log("Scrap closed, list of causes unchanged");
          break;
        }

        this.civils.push(...rols);

        if (page < totalPages) {
          await this.goToNextPage();
          console.log(`Go to next page: ${page}`);
        }
      }
      console.log(`Total rol collected: ${this.civils.length}`);
    } catch (error) {
      console.error("Error collecting causes:", error);
      throw error;
    }
  }

  private continueWithScrap(rols: CivilCauseActive[]): boolean {
    if (!this.civilMostRecent) {
      return true;
    }

    const mostRecentCauseInput = rols.reduce(
      (mostRecent, current) =>
        current.admissionAt > mostRecent.admissionAt ? current : mostRecent,
      rols[0]
    );

    return this.civilMostRecent.admissionAt < mostRecentCauseInput.admissionAt;
  }

  getCauses() {
    return this.civils;
  }

  private async collectRit(): Promise<CivilCauseActive[]> {
    await this.scrap.waitForSelector("div.loadTotalCiv>b");
    const causes = await this.page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll("tbody#verDetalleMisCauCiv>tr")
      );

      return rows
        .map((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
          const getData = (index: number) =>
            cells[index]?.textContent?.trim() || "";

          return {
            rol: getData(1),
            court: getData(2),
            cover: getData(3),
            admissionAt: getData(4),
            processBook: getData(5),
            book: getData(6),
          };
        })
        .filter((item) => item.rol.length > 0 && item.admissionAt.length > 0);
    });

    return causes.map((civil) => ({
      ...civil,
      admissionAt: this.parseDate(civil.admissionAt),
    }));
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

  private get page() {
    return this.scrap.getPage();
  }

  private parseDate(dateString: string): Date {
    const [day, month, year] = dateString.split("/").map(Number);
    return new Date(year, month - 1, day);
  }

  async finish() {
    return this.scrap.close();
  }
}
