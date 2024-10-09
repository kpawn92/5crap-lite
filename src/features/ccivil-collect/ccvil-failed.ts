import { parseDate } from "../../tools/parse-date";
import { Scrape } from "../../tools/scrape";
import { timeout } from "../../tools/timeout";
import type { Anchor, Documentation } from "./civil-detail";

export class CivilFailed {
  private readonly newURLs: Documentation[] = [];

  constructor(
    private readonly scrap: Scrape,
    private docs: Documentation[],
    private readonly anchors: Anchor[]
  ) {}

  async getNewsURLs() {
    await this.launchModal();
    return this.newURLs;
  }

  private async launchModal(): Promise<void> {
    try {
      for (const [index, anchor] of this.anchors.entries()) {
        console.log(`Processing cause ${index + 1}/${this.anchors.length}...`);
        await this.scrap.execute(anchor.script);
        await timeout(1500);

        for (const doc of this.docs) {
          const newDoc = await this.extractDocURL(doc);
          newDoc && this.newURLs.push(newDoc);
        }

        await timeout(1000);

        await this.closeModal();
        await timeout(2000);
      }
    } catch (error) {
      console.error("Error collecting details:", error);
      throw error;
    }
  }

  private async extractDocURL(
    doc: Documentation
  ): Promise<Documentation | null> {
    const { procedure, descProcedure, index } = doc;
    try {
      await this.scrap.waitForSelector("div#loadHistCuadernoCiv", 5000);

      const movements = await this.scrap.page.evaluate(() => {
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
      const newDoc = movements.find(
        (item) =>
          item.procedure === procedure && item.descProcedure === descProcedure
      );
      if (!newDoc || !newDoc.document[index]) return null;

      return {
        index,
        url: newDoc.document[index],
        dateProcedure: parseDate(newDoc.dateProcedure),
        descProcedure: newDoc.descProcedure,
        procedure: newDoc.procedure,
      };
    } catch (error) {
      console.error("Error extracting movements history:", error);
      throw error;
    }
  }

  private async closeModal() {
    return this.scrap.page.evaluate(() => {
      const close = document.querySelector<HTMLButtonElement>("button.close");
      close?.click();
    });
  }
}
