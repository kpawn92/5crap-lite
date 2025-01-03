import { parentPort } from "node:worker_threads";
import { updateRepository } from "../../db/document-updater";
import { processDocuments } from "./document-proccess";
import { DownloadOptions } from "./worker-launch-document";
import type { IssueOptions, ModeDocument } from "./worker.types";
import { processManager } from "../../core/process.manager";
import eventManager from "../../core/event";

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
    const cause = documents[0].cause;
    processManager.createProcess(cause);

    const workerId = `${cause}.${mode}`;

    console.log("Cantidad de documents: ", documents.length);
    console.log("Dentro del worker");

    try {
      processManager.addWorker(cause, workerId);

      await processDocuments(documents, async (rol, filename) => {
        console.log(`Init update : ${filename}`);
        await updateRepository(rol, filename, mode, issue);
      });

      processManager.updateWorkerStatus(cause, workerId, "success");
      eventManager.emit("worker-completed", { processName: cause, workerId });

      parentPort?.postMessage({ status: "success" });
    } catch (error) {
      processManager.updateWorkerStatus(cause, workerId, "failed");

      if (error instanceof Error)
        parentPort?.postMessage({ status: "error", error: error.message });
    } finally {
      // Verifica si quedan workers pendientes
      const process = processManager.getProcess(cause);
      if (process) {
        const hasPendingWorkers = process.workers.some(
          (worker) =>
            worker.status === "pending" || worker.status === "in_progress"
        );

        // Si no quedan workers pendientes, actualiza el estado del proceso
        if (!hasPendingWorkers) {
          const allWorkersSuccessful = process.workers.every(
            (worker) => worker.status === "success"
          );

          processManager.updateProcessState(
            cause,
            allWorkersSuccessful ? "success" : "in_progress"
          );
          allWorkersSuccessful &&
            eventManager.emit("process-state-changed", {
              newState: "success",
              processName: cause,
            });
          console.log(`[INFO]:: Proccess ${cause} finished`);
        }
      }

      // Limpieza: cierra el puerto del Worker para liberar recursos
      console.log(`[INFO]: Worker finished ${workerId} by ${issue}-${mode}`);
      parentPort?.close();
    }
  }
);
