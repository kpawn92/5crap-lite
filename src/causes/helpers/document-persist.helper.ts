import EventEmitter from "node:events";
import { Page } from "puppeteer";
import { FileSystemService } from "../../plugins/file.plugin";
import { parseStringToCode } from "../parse-string";
import { codeUnique } from "./code-calc";
import { AnexRequest } from "./history-scrape";

export class DocumentAnnexPersistHelper extends EventEmitter {
  constructor(
    private readonly cause: string,
    private readonly storage: FileSystemService,
    private readonly page: Page,
    private readonly annexs: AnexRequest[]
  ) {
    super();
    this.on("start-down", (msg: string) => {
      console.log(msg);
    });
    this.on("finish-down", (msg: string) => {
      console.log(msg);
    });
    this.on("res-down", (msg: string, code: number, filename: string) => {
      console.log(msg);
      console.log("Code: ", code);
      console.log(filename);
    });
    this.annexsEvaluate();
  }

  makeFilenames() {
    const docs: string[] = [];

    this.annexs.forEach((item) => {
      docs.push(this.evaluateAnnex(item).filename);
    });

    return docs;
  }

  async annexsEvaluate() {
    this.emit(
      "start-down",
      `Starting document download for ${this.annexs.length} documents...`
    );
    await Promise.allSettled(this.annexs.map((doc) => this.docManager(doc)));
    this.emit("finish-down", "All documents downloaded.");
  }

  private async docManager(annex: AnexRequest) {
    const { document, filename } = this.evaluateAnnex(annex);
    const response = await this.fetchDocument(document);

    this.emit("res-down", "Request response", response.code, filename);

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
