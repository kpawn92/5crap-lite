import { envs } from "./config/envs";
import { mongodb } from "./db";
import { AuthOptions, startauth } from "./features/auth/auth-simule";
import { ccivil } from "./features/ccivil-collect/ccivil-scrape";
import { navigateTab } from "./features/shared/navegate";

interface Options extends AuthOptions {
  roles?: string[];
}
async function scrapefactory({ roles, ...options }: Options) {
  await mongodb.connect({
    dbName: envs.MONGO_DB_NAME,
    url: envs.MONGO_URI,
  });

  await startauth(options, roles, [navigateTab.civil, ccivil]);

  console.log("Scrape finish");
  process.exit();
}

scrapefactory({
  rut: envs.RUT,
  key: envs.PASS,
  url: envs.PAGE,
  headless: envs.NODE_ENV === "production",
  roles: ["C-2751-2024", "C-1781-2024"],
});
