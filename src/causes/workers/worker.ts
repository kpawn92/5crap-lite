import { parentPort } from "node:worker_threads";
import { processDocuments } from "./document-proccess";
import { DownloadOptions } from "./worker-launch-document";
import { dailyDocumentUpdater } from "../../db/daily-updater";
import { ccaseDocumentUpdater } from "../../db/ccause-updater";
import type { IssueOptions } from "./worker.types";

if (!parentPort) {
  throw new Error("This file must be run as a Worker.");
}

parentPort.on(
  "message",
  async (data: { documents: DownloadOptions[]; issue: IssueOptions }) => {
    const { documents, issue } = data;
    console.log("Cantidad de documents: ", documents.length);
    console.log("Dentro del worker");

    try {
      await processDocuments(documents, async (rol, filename) => {
        issue === "daily" && (await dailyDocumentUpdater(rol, filename));
        issue === "one" && (await ccaseDocumentUpdater(rol, filename));
      });

      parentPort?.postMessage({ status: "success" });
    } catch (error) {
      if (error instanceof Error)
        parentPort?.postMessage({ status: "error", error: error.message });
    }
  }
);
