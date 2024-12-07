import EventEmitter from "node:events";
import { Page } from "puppeteer";
import { FileSystemService } from "../../plugins/file.plugin";
import { parseStringToCode } from "../parse-string";
import { codeUnique } from "./code-calc";
import { AnexRequest } from "./history-scrape";
import { UpdaterHelper } from "./document-all.helper";

export class DocumentAnnexPersistHelper {
  constructor(
    private readonly updater: UpdaterHelper,
    private readonly cause: string,
    private readonly storage: FileSystemService,
    private readonly page: Page,
    private readonly annexs: AnexRequest[]
  ) {}

  private async evalResponse(code: number, rol: string, filename: string) {
    console.log("Response code: ", code);
    await this.updater(rol, filename);
    console.log("Database updated");
  }

  makeFilenames() {
    const docs: string[] = [];

    this.annexs.forEach((item) => {
      docs.push(this.evaluateAnnex(item).filename);
    });

    return docs;
  }

  async annexsEvaluate() {
    console.log(
      `Starting document download for ${this.annexs.length} documents...`
    );
    await Promise.allSettled(this.annexs.map((doc) => this.docManager(doc)));
    console.log("All documents downloaded.");
  }

  private async docManager(annex: AnexRequest) {
    const { document, filename } = this.evaluateAnnex(annex);
    const response = await this.fetchDocument(document);

    console.log("Request response", response.code, filename);

    response.code !== 200 &&
      this.evalResponse(response.code, this.cause, filename);

    if (response.code === 200) {
      this.storage.writeDocumentByCause(response.buffer, this.cause, filename);
    }
  }

  private evaluateAnnex(annex: AnexRequest) {
    const { date, descProcedure, document, procedure, reference } = annex;
    const filename = `${parseStringToCode(procedure)}_${parseStringToCode(
      descProcedure
    )}_${codeUnique(date)}_${parseStringToCode(reference)}_anexo`;
    return { filename, document };
  }

  private async fetchDocument(docURL: string) {
    const response = await this.page.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          return {
            code: response.status,
            buffer: [],
          };
        }

        const buffer = await response.arrayBuffer();
        return {
          code: 200,
          buffer: Array.from(new Uint8Array(buffer)),
        };
      } catch (error) {
        // console.log("Error fetching PDF:", error);
        return {
          code: 500,
          buffer: [],
        };
      }
    }, docURL);
    return response;
  }
}
