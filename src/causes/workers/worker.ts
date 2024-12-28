import { parentPort } from "node:worker_threads";
import { updateRepository } from "../../db/document-updater";
import { processDocuments } from "./document-proccess";
import { DownloadOptions } from "./worker-launch-document";
import type { IssueOptions, ModeDocument } from "./worker.types";

if (!parentPort) {
  throw new Error("This file must be run as a Worker.");
}

parentPort.on(
  "message",
  async (data: {
    documents: DownloadOptions[];
    issue: IssueOptions;
    mode: ModeDocument;
  }) => {
    const { documents, issue, mode } = data;
    console.log("Cantidad de documents: ", documents.length);
    console.log("Dentro del worker");

    try {
      await processDocuments(documents, async (rol, filename) => {
        console.log(`Init update : ${filename}`);
        await updateRepository(rol, filename, mode, issue);
      });

      parentPort?.postMessage({ status: "success" });
    } catch (error) {
      if (error instanceof Error)
        parentPort?.postMessage({ status: "error", error: error.message });
    } finally {
      // Limpieza: cierra el puerto del Worker para liberar recursos
      parentPort?.close();
    }
  }
);
