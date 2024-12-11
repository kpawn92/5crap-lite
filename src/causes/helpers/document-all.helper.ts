import {
  DownloadOptions,
  runWorkerDocument,
} from "../workers/worker-launch-document";
import { IssueOptions } from "../workers/worker.types";

export class DocumentAllHelper {
  constructor(
    private readonly documents: DownloadOptions[],
    private readonly issue: IssueOptions
  ) {}

  async documentationEvaluate() {
    console.log(
      `Starting document download for ${this.documents.length} documents...`
    );
    console.table(
      this.documents.map(({ cause, filename }) => ({ cause, filename }))
    );
    runWorkerDocument(this.documents, this.issue);
    console.log("Worker corriendo con las evaluaciones de los documentos...");
  }
}
