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
  private readonly anchors: Array<Anchor>;
  private readonly causes: Array<CauseCivilPrimitives>;

  constructor(
    private readonly scrap: ScrapService,
    private readonly fileService: FileSystemService
  ) {
    this.anchors = [];
    this.causes = [];
  }

  async init() {
    await this.scrap.init();
  }

  async finish() {
    this.fileService.write(this.causes);
    console.log("File causes to json created");
    return this.scrap.close();
  }

  async navegateTabCivilCause() {
    await this.scrap.clickElement('a[onclick="misCausas();"]', 3500);
    await this.scrap.clickElement("a#civilTab", 3500);
    await this.scrap.simuleBodyAction();
    console.log("Navegation tab civil");
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
    await this.scrap.waitForSelector("tbody#verDetalleMisCauCiv", 500);
    await this.scrap.waitForSelector("div.loadTotalCiv", 500);
    // await this.scrap.waitForSelector("a#sigId", 500);
    await this.scrap.simuleBodyAction();

    const totalItem = await this.page.evaluate(() => {
      return document.querySelector("div.loadTotalCiv>b")?.textContent || "0";
    });
    const pagination = Pagination.run(+totalItem);
    console.log("Pagination: ", pagination);
    // await this.page.evaluate(() => {
    //   window.scrollTo(document.body.scrollWidth, document.body.scrollHeight);
    // });

    for (const page of pagination) {
      const anchors = await this.collectAnchors();

      await this.page.evaluate(() => {
        const next = document.querySelector("a#sigId") as HTMLAnchorElement;
        return next?.click();
      });
      console.log("Page:", page);
      console.log("Anchors:", anchors.length);
      await this.scrap.timeout(3000);
    }
  }

  private async collectAnchors() {
    await this.scrap.waitForSelector("tbody#verDetalleMisCauCiv");

    const anchorElements = await this.page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll("tbody#verDetalleMisCauCiv>tr")
      );

      return rows.map(
        (row) =>
          row
            .querySelector('a[href="#modalAnexoCausaCivil"]')
            ?.getAttribute("onclick") || ""
      );
    });

    for (const anchor of anchorElements) {
      anchor.length > 0 &&
        this.anchors.push({
          script: anchor,
        });
    }

    return this.anchors;
  }

  async collectDetail() {
    this.causes.length = 0;

    for (const anchor of this.anchors) {
      await this.scrap.execute(anchor.script);
      await this.scrap.timeout(1500);
      const cause = await this.extractDetail();
      console.log("Cause extract: ", cause);
      await this.scrap.timeout(2000);

      const movementsHistory = await this.extractHistory();
      console.log("MovementHistory: ", movementsHistory);

      const litigants = await this.extractLitigant();
      console.log("Litigant: ", litigants);

      this.causes.push({
        ...cause,
        movementsHistory,
        litigants,
      });
      await this.scrap.timeout(2000);
    }
  }

  private async extractDetail(): Promise<
    Omit<CauseCivilPrimitives, "movementsHistory" | "litigants">
  > {
    await this.scrap.waitForSelector(
      'div[style="background-color:#F9F9F9"]',
      500
    );
    const causesScrap = await this.page.evaluate(() => {
      const cells = Array.from(
        document.querySelectorAll(
          'div[style="background-color:#F9F9F9"]>table:nth-child(1) td'
        )
      );

      const book =
        document.querySelector("select#selCuaderno>option[selected]")
          ?.textContent || "";

      const getData = (index: number, prefix: string) =>
        cells[index]?.textContent?.trim().replace(prefix, "").trim() || "";

      return {
        rol: getData(0, "ROL:"),
        admission: getData(1, "F. Ing.:"),
        cover: getData(2, ""),
        estAdmin: getData(3, "Est. Adm.:"),
        process: getData(4, "Proc.:"),
        location: getData(5, "Ubicación:"),
        processState: getData(6, "Estado Proc.:"),
        stage: getData(7, "Etapa:"),
        court: getData(8, "Tribunal:"),
        book,
      };
    });

    return {
      ...causesScrap,
      admission: this.ensureDate(causesScrap.admission),
    };
  }

  private async extractHistory(): Promise<Movement[]> {
    await this.scrap.waitForSelector("div#loadHistCuadernoCiv", 500);

    const historiesScrap = await this.page.evaluate(() => {
      const container = document.querySelector("div#loadHistCuadernoCiv");
      const rowsNode =
        container?.querySelector("table>tbody")?.querySelectorAll("tr") || [];

      const rows = Array.from(rowsNode);
      return rows.map((row) => {
        const getData = (index: number) =>
          cells[index]?.textContent?.trim() || "";

        const cells = Array.from(row.querySelectorAll("td"));

        const forms = Array.from(cells[1].querySelectorAll("form"));
        const collectDocumentURL = forms.map((form) => {
          const action = form.action;
          const query = form.querySelector("input")?.name;
          const token = form.querySelector("input")?.value;

          return `${action}?${query}=${token}`;
        });
        return {
          invoice: getData(0),
          document: collectDocumentURL,
          stage: getData(3),
          procedure: getData(4),
          descProcedure: getData(5),
          dateProcedure: getData(6),
          page: +getData(7),
        };
      });
    });

    return historiesScrap.map((history) => {
      return {
        ...history,
        dateProcedure: this.ensureDate(history.dateProcedure),
      };
    });
  }

  private async extractLitigant(): Promise<Litigant[]> {
    await this.page.click('a[href="#litigantesCiv"]');
    await this.scrap.timeout(1200);
    return this.page.evaluate(() => {
      const container = document.querySelector(
        "div#litigantesCiv"
      ) as HTMLDivElement;
      const rows = Array.from(container.querySelectorAll("table>tbody>tr"));
      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        const getData = (index: number) =>
          cells[index]?.textContent?.trim() || "";

        return {
          participant: getData(0),
          rut: getData(1),
          person: getData(2),
          name: getData(3),
        };
      });
    });
  }

  async collectDocuments() {
    const urls = this.getURLs();
    await Promise.all(urls.map((doc) => this.extractDocument(doc)));
    console.log("Collect full file documents");
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

  private ensureDate(dateString: string): Date {
    const [day, month, year] = dateString.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
}
