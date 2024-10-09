import { parseDate } from "../../tools/parse-date";
import { Scrape } from "../../tools/scrape";
import { timeout } from "../../tools/timeout";
import { pagination } from "../shared/pagination";

interface Civil {
  rol: string;
  court: string;
  cover: string;
  admissionAt: Date;
  processBook: string;
  book: string;
}

export class CivilCollect {
  private civils: Civil[] = [];

  constructor(
    private readonly scrape: Scrape,
    private readonly lastRecord?: Civil
  ) {}

  async rawData(): Promise<Civil[]> {
    try {
      await this.scrape.waitForSelector("tbody#verDetalleMisCauCiv", 3000);
      await this.scrape.waitForSelector("div.loadTotalCiv");
      await this.scrape.simuleBodyAction();

      const totalItems = await this.getTotalItems();
      const pages = pagination.calc(totalItems);
      const totalPages = pages.length;
      console.log(`Total items: ${totalItems}, Total pages: ${totalPages}`);

      for (const page of pages) {
        const rols = await this.collectRit();
        console.table(rols);

        const { next, items: news } = this.beforeNext(rols, this.lastRecord);

        if (!next) {
          console.log("News causes civils: ");
          console.table(news);
          this.civils.push(...news);
          break;
        }

        this.civils.push(...rols);

        if (page < totalPages) {
          await this.goToNextPage();
          console.log(`Go to next page: ${page + 1}`);
        }
      }

      console.log(`Total rol collected: ${this.civils.length}`);

      return this.civils;
    } catch (error) {
      console.error("Error collecting causes:", error);
      throw error;
    }
  }

  private beforeNext(civils: Civil[], last?: Civil) {
    if (!last) return { next: true, items: [] };
    console.log("Last record: ");
    console.table(last);

    const stop = civils.some((item) => item.admissionAt > last.admissionAt);
    console.log("Next: ", stop);

    return {
      next: stop,
      items: stop
        ? civils.filter((item) => item.admissionAt > last.admissionAt)
        : [],
    };
  }

  private async goToNextPage(): Promise<void> {
    try {
      await this.scrape.page.evaluate(() => {
        const nextButton = document.querySelector<HTMLAnchorElement>("a#sigId");
        nextButton?.click();
      });
      await timeout(3000);
      await this.scrape.waitForSelector("tbody#verDetalleMisCauCiv", 5000);
      console.log("Navigated to next page.");
    } catch (error) {
      console.error("Error navigating to next page:", error);
      throw error;
    }
  }

  private async collectRit(): Promise<Civil[]> {
    await this.scrape.waitForSelector("div.loadTotalCiv>b");
    const causes = await this.scrape.page.evaluate(() => {
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
      admissionAt: parseDate(civil.admissionAt),
    }));
  }

  private async getTotalItems(): Promise<number> {
    try {
      const totalItemsText = await this.scrape.page.evaluate(() => {
        return document.querySelector("div.loadTotalCiv>b")?.textContent || "0";
      });
      const totalItems = parseInt(totalItemsText, 10);
      return isNaN(totalItems) ? 0 : totalItems;
    } catch (error) {
      console.log("error get total items");
      throw error;
    }
  }
}
