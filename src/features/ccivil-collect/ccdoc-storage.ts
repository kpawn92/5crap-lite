import { FileSystemService } from "../../plugins";
import { codeUnique } from "../../tools/code-unique";
import { parseStringToCode } from "../../tools/parse-string";
import { Scrape } from "../../tools/scrape";
import { Documentation } from "./civil-detail";

export class DocumentStorage {
  private failed: Documentation[] = [];

  constructor(
    private readonly scrape: Scrape,
    private readonly storage: FileSystemService,
    private readonly rol: string
  ) {}

  async download(urls: Documentation[]) {
    console.log(`Starting document download for ${urls.length} documents...`);
    await Promise.allSettled(urls.map((doc) => this.extractDocument(doc)));
    console.log("All documents downloaded.");
    return this.failed;
  }

  private async extractDocument(doc: Documentation) {
    const { url, dateProcedure, descProcedure, index, procedure } = doc;
    const filename = this.genName({
      dateProcedure,
      descProcedure,
      index,
      procedure,
    });

    console.log(`Init extract document: ${filename}`);
    const pdfArray = await this.extractPDF(url);

    if (!pdfArray) {
      this.failed.push(doc);
      return;
    }

    this.storage.writeDocumentByCause(pdfArray, this.rol, filename);
    console.log("Document collect: ", filename);
  }

  private genName(history: {
    procedure: string;
    descProcedure: string;
    dateProcedure: Date;
    index: number;
  }): string {
    return `${parseStringToCode(history.procedure)}_${parseStringToCode(
      history.descProcedure
    )}_${codeUnique(history.dateProcedure)}_[${history.index}].pdf`;
  }

  private async extractPDF(pdfUrl: string) {
    const pdfBuffer = await this.scrape.page.evaluate(async (url) => {
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
}
