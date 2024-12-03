import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import { envs } from "./env.plugin";
import EventEmitter from "events";
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

export class ScrapService extends EventEmitter {
  private browser: Browser | null = null;
  private page: Page | null = null;

  getBrowser(): Browser {
    return this.browser!;
  }

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

    // await this.page.goto(url, {
    //   waitUntil: "domcontentloaded",
    //   timeout: 0,
    // });
    await this.pageGoto(url);

    console.log(`Init scrap to: <${url}>`);

    await this.login();
  }

  private async invalidLoadImages() {
    // //? No cargar las imagenes
    await this.page?.setRequestInterception(true);
    return this.page?.on("request", async (request) => {
      if (request.resourceType() == "image") {
        await request.abort();
      } else {
        await request.continue();
      }
    });
  }

  async pageGoto(url: string) {
    const maxRetries = 3;
    const delay = 600000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Intento ${attempt} load page...`);
        const response = await this.page!.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 5 * 60 * 1000, // 5min wait
        });

        if (response?.ok()) {
          console.log("Pagina cargada correctamente: ", response?.status());
          return;
        } else {
          console.log("Error al cargar la pagina: ", response?.status());
        }
      } catch (error) {
        console.log("Error durante la carga de la pagina: ", error);
      }

      if (attempt < maxRetries) {
        this.emit("retryPage", "Esperando 10min antes del proximo intento...");
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    this.emit(
      "closeBrowser",
      "Se alcanzo el numero maximo de intentos...",
      this.browser
    );
  }

  async simuleBodyAction(otherPage?: Page) {
    return (otherPage || this.page)?.evaluate(() => {
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

  async clickElement(
    selector: string,
    delay = 1000,
    otherPage?: Page
  ): Promise<void> {
    await (otherPage || this.page)?.waitForSelector(selector, { timeout: 0 });
    await (otherPage || this.page)?.click(selector);
    await this.timeout(delay);
  }

  async waitForSelector(
    selector: string,
    delay = 1000,
    visible?: boolean,
    otherPage?: Page
  ): Promise<void> {
    await (otherPage || this.page)?.waitForSelector(selector, {
      timeout: 0,
      visible,
    });
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
