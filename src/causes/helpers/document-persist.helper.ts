import EventEmitter from "events";
import { Page } from "puppeteer";
import { FileSystemService } from "../../plugins/file.plugin";
import { parseStringToCode } from "../parse-string";
import { codeUnique } from "./code-calc";
import { AnexRequest } from "./history-scrape";

export class DocumentAnnexPersistHelper {
  private readonly documents: string[] = [];

  constructor(
    private readonly cause: string,
    private readonly storage: FileSystemService,
    private readonly page: Page,
    private readonly annexs: AnexRequest[]
  ) {}

  async annexsEvaluate() {
    console.log(
      `Starting document download for ${this.annexs.length} documents...`
    );
    await Promise.allSettled(this.annexs.map((doc) => this.docManager(doc)));
    console.log("All documents downloaded.");

    return this.documents;
  }

  private async docManager(annex: AnexRequest) {
    const { date, descProcedure, document, procedure, reference } = annex;
    const filename = `${parseStringToCode(procedure)}_${parseStringToCode(
      descProcedure
    )}_${codeUnique(date)}_${reference}_anexo`;

    const response = await this.fetchDocument(document);
    console.log("Document request response", response, filename);

    if (response.code === 200) {
      this.storage.writeDocumentByCause(response.buffer, this.cause, filename);
      this.documents.push(filename);
    }
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
