import { Browser } from "puppeteer";
import { FileSystemService, ScrapService } from "../../plugins";
import { EventService } from "../../plugins/event-emitir";
import { Daily, Doc, FiltersDaily } from "./daily";

export const scrapeDaily = async (filters: FiltersDaily) => {
  const scrape = new ScrapService();
  const storage = new FileSystemService();
  const event = new EventService();
  const daily = new Daily(scrape, storage, event);

  scrape.on("retryPage", (msg) => {
    console.log(msg);
  });

  scrape.on("closeBrowser", async (msg: string, browser: Browser) => {
    console.log(msg);
    await browser.close();
    process.exit();
  });

  event.on("anchorsIsEmpty", (msg) => {
    console.log(msg);
    process.exit();
  });

  event.on("failedCaptureAnchors", (msg) => {
    console.log(msg);
    process.exit();
  });

  event.on("failedToReceivePDF", async (doc: Doc) => {
    console.log("Error extract document PDF...");
    console.log("Procedure", doc.procedure);
    console.log("Rol", doc.rol);
    await daily.retryProccess(doc);
  });

  await scrape.init();
  await daily.rawData(filters);
  await daily.collectDocuments();

  return daily.getccivils();
};
