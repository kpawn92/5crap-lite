import { Scrape } from "../../tools/scrape";
import { timeout } from "../../tools/timeout";
import { LaunchOptions } from "../shared/types";

export interface AuthOptions extends LaunchOptions {
  rut: string;
  key: string;
}
type CallbackExtend = (scrape: Scrape, roles?: string[]) => Promise<void>;

export async function startauth(
  options: AuthOptions,
  roles?: string[],
  callbacks: CallbackExtend[] = []
) {
  const { url, headless, key, rut } = options;

  const scrape = new Scrape();
  await scrape.init(url, headless);

  try {
    console.log("Init process authentication...");
    await scrape.page.evaluate(() => {
      eval("AutenticaCUnica();");
    });
    await timeout(4000);

    await scrape.waitForSelector("input#uname", 0);
    await scrape.waitForSelector('input[type="password"]', 0);

    await scrape.page.type("input#uname", rut);
    await scrape.page.type('input[type="password"]', key);
    await scrape.page.click("button#login-submit");

    await scrape.page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    console.log("Authenticated");
    await timeout(2000);

    for (const callback of callbacks) {
      await callback(scrape, roles);
    }
  } catch (error) {
    console.log("Error authentication");
    throw error;
  }
}
