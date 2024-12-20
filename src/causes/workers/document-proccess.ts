import { dailyDocumentUpdater } from "../../db/daily-updater";
import { UpdateRepository } from "../../db/db.types";
import { FileSystemService } from "../../plugins";
import { wait } from "../../plugins/wait";
import { fetchDocument } from "./document-fetch";
import { DownloadOptions } from "./worker-launch-document";

export async function processDocuments(
  documents: DownloadOptions[],
  updater: (cause: string, filename: string) => Promise<void>
) {
  const batchSize = 10; // Tamaño del lote
  const delayMs = 3000; // Tiempo de espera entre lotes
  const storage = new FileSystemService();

  const processBatch = async (batch: DownloadOptions[]) => {
    for (const doc of batch) {
      const { url, filename, cause } = doc;

      console.log("Init extract: ", filename);
      const response = await fetchDocument(url);
      console.log("Response code fetching: ", response.code, filename);

      if (response.code !== 200) {
        console.log("Response failed: ", response.code);
        await updater(cause, filename);
      }

      if (response.code === 200) {
        storage.writeDocumentByCause(response.buffer, cause, filename);
        console.log(`Saved document: ${filename}.pdf`);
      }
    }
  };

  // Divide los documentos en lotes y procesa cada uno con un retraso
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize); // Obtiene el lote actual
    console.log(`Processing batch ${Math.ceil(i / batchSize) + 1}`);
    await processBatch(batch); // Procesa el lote
    if (i + batchSize < documents.length) {
      console.log(`Waiting ${delayMs / 1000} seconds before the next batch...`);
      await wait(delayMs); // Introduce el retraso
    }
  }

  console.log("All documents processed.");
}
