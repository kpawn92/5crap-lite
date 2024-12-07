import EventEmitter from "node:events";
import { Page } from "puppeteer";
import { FileSystemService } from "../../plugins";

export type UpdaterHelper = (rol: string, filename: string) => Promise<void>;

interface DownloadOptions {
  url: string;
  filename: string;
  cause: string;
}
export class DocumentAllHelper {
  constructor(
    private readonly updater: UpdaterHelper,
    private readonly page: Page,
    private readonly storage: FileSystemService,
    private readonly documents: DownloadOptions[]
  ) {}

  async evalResponse(code: number, rol: string, filename: string) {
    console.log("Response code: ", code);
    console.log("Document", filename);
    if (code !== 200) {
      await this.updater(rol, filename);
      console.log("Database updated");
    }
  }

  async documentationEvaluate() {
    console.log(
      `Starting document download for ${this.documents.length} documents...`
    );
    console.table(
      this.documents.map(({ cause, filename }) => ({ cause, filename }))
    );

    await Promise.allSettled(
      this.documents.map(async (doc) => await this.docManager(doc))
    );
    console.log("All documents downloaded.");
  }

  private async docManager(options: DownloadOptions) {
    const { url, filename, cause } = options;
    const response = await this.fetchDocument(url);

    await this.evalResponse(response.code, cause, filename);

    if (response.code === 200) {
      this.storage.writeDocumentByCause(response.buffer, cause, filename);
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
        return {
          code: 500,
          buffer: [],
        };
      }
    }, docURL);
    return response;
  }
}
