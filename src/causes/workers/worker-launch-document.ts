import path from "node:path";
import { Worker } from "node:worker_threads";
import type { IssueOptions, ModeDocument } from "./worker.types";

export interface DownloadOptions {
  url: string;
  filename: string;
  cause: string;
}

export function runWorkerDocument(
  documents: DownloadOptions[],
  issue: IssueOptions,
  mode: ModeDocument
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, "./worker.js"));

    console.log("Init worker...");
    worker.postMessage({ documents, issue, mode });

    worker.on("message", (message) => {
      if (message.status === "success") {
        resolve();
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
