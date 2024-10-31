import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import { envs } from "./env.plugin";
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

export class ScrapService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(url = "https://oficinajudicialvirtual.pjud.cl/home/index.php") {
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      slowMo: 400,
    });
    this.page = await this.browser.newPage();

    //? Modify navigator.webdriver before load page.
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    console.log(`Init scrap to: <${url}>`);

    await this.login();
  }

  async simuleBodyAction() {
    return this.page?.evaluate(() => {
      document.querySelector("body")?.click();
    });
  }

  getPage(): Page {
    if (!this.page) throw new Error("Undefined page property");
    return this.page;
  }

  private async login() {
    await this.page?.evaluate(() => {
      eval("AutenticaCUnica();");
    });
    await this.timeout(4000);

    await this.page?.waitForSelector("input#uname", { timeout: 0 });
    await this.page?.waitForSelector('input[type="password"]', { timeout: 0 });

    await this.page?.type("input#uname", envs.RUT);
    await this.page?.type('input[type="password"]', envs.PASS);
    await this.page?.click("button#login-submit");
    await this.page?.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    console.log("Authenticated");
    await this.timeout(2000);
  }

  async clickElement(selector: string, delay = 1000): Promise<void> {
    await this.page?.waitForSelector(selector, { timeout: 0 });
    await this.page?.click(selector);
    await this.timeout(delay);
  }

  async waitForSelector(
    selector: string,
    delay = 1000,
    visible?: boolean
  ): Promise<void> {
    await this.page?.waitForSelector(selector, { timeout: 0, visible });
    await this.timeout(delay);
  }

  async execute(script: string, delay = 4000): Promise<void> {
    await this.page?.evaluate((script) => eval(script), script);
    await this.timeout(delay);
  }

  public timeout(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    await this.browser?.close();
    console.log("Scrap finish");
  }
}
