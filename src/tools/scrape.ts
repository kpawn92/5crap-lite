import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import { timeout } from "./timeout";
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

export class Scrape {
  private browserInside: Browser | null = null;
  private pageInside: Page | null = null;

  public async init(url: string, headless?: boolean) {
    await this.launch(headless);
    await this.goTo(url);
  }

  public async newPage(): Promise<Page> {
    return this.browser.newPage();
  }

  private async launch(headless = false) {
    try {
      this.browserInside = await puppeteer.launch({
        headless,
        defaultViewport: null,
        slowMo: 400,
      });
      this.pageInside = await this.browserInside.newPage();
    } catch (error) {
      console.log("Error in launch");
      throw error;
    }
  }

  private async goTo(url: string) {
    try {
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 0,
      });

      console.log(`Init scrap to: <${url}>`);
    } catch (error) {
      console.log("Error in navigation");
    }
  }

  get page(): Page {
    if (!this.pageInside) throw "Undefined page property";
    return this.pageInside;
  }

  private get browser(): Browser {
    if (!this.browserInside) throw "Undefined browser property";
    return this.browserInside;
  }

  async simuleBodyAction() {
    return this.page.evaluate(() => {
      document.querySelector("body")?.click();
    });
  }

  async clickElement(selector: string, delay = 1000): Promise<void> {
    await this.waitForSelector(selector, delay);
    await this.page.click(selector);
    timeout(delay);
  }

  async waitForSelector(selector: string, delay = 1000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout: 0 });
    timeout(delay);
  }

  async execute(script: string, delay = 4000): Promise<void> {
    await this.page.evaluate((script) => eval(script), script);
    timeout(delay);
  }

  async close(): Promise<void> {
    await this.browser.close();
    console.log("Scrap finish");
  }
}
