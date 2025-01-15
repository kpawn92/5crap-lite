import { randomUUID as uuid } from "node:crypto";
import {
  DownloadOptions,
  runWorkerDocument,
} from "../workers/worker-launch-document";
import { IssueOptions } from "../workers/worker.types";
import { AnexRequest } from "./history-scrape";

export interface AnnexReturn {
  file: string;
  reference: string;
  date: Date;
  guid: string;
}

export class DocumentAnnexPersistHelper {
  constructor(
    private readonly cause: string,
    private readonly annexs: AnexRequest[],
    private readonly issue: IssueOptions
  ) {}

  makeFilenames() {
    const docs: AnnexReturn[] = [];

    this.annexs.forEach((item) => {
      docs.push({
        file: `${this.evaluateAnnex(item).filename}.pdf`,
        reference: item.reference,
        date: item.date,
        guid: item.guid,
      });
    });

    return docs;
  }

  public annexsEvaluate() {
    console.log(
      `Starting document download for ${this.annexs.length} documents...`
    );

    runWorkerDocument(
      this.annexs.map((item) => this.evaluateAnnex(item)),
      this.issue,
      "annex"
    );

    console.log("Worker corriendo con las evaluaciones de los anexos...");
  }

  private evaluateAnnex(annex: AnexRequest): DownloadOptions {
    const { document } = annex;

    const filename = `${uuid()}_anexo`;
    return { filename, url: document, cause: this.cause };
  }
}
