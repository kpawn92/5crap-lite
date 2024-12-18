import { parseStringToCode } from "../parse-string";
import {
  DownloadOptions,
  runWorkerDocument,
} from "../workers/worker-launch-document";
import { IssueOptions } from "../workers/worker.types";
import { codeUnique } from "./code-calc";
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
        file: this.evaluateAnnex(item).filename,
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
      this.issue
    );

    console.log("Worker corriendo con las evaluaciones de los anexos...");
  }

  private evaluateAnnex(annex: AnexRequest): DownloadOptions {
    const { date, descProcedure, document, procedure, reference } = annex;
    const filename = `${parseStringToCode(procedure)}_${parseStringToCode(
      descProcedure
    )}_${codeUnique(date)}_${parseStringToCode(reference)}_anexo`;
    return { filename, url: document, cause: this.cause };
  }
}
