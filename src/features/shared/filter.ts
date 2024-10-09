import { Scrape } from "../../tools/scrape";
import { timeout } from "../../tools/timeout";

export class Filter {
  constructor(private readonly scrape: Scrape) {}

  async apply(params?: { role: string }) {
    try {
      await this.scrape.page.evaluate((params) => {
        const statusSelect = document.querySelector<HTMLSelectElement>(
          "#estadoCausaMisCauCiv"
        );
        if (statusSelect) {
          statusSelect.value = "1";
        }

        if (params?.role) {
          const [rit, rol, year] = params.role.split("-");
          const ritElement = document.querySelector<HTMLSelectElement>(
            "select#tipoMisCauCiv"
          );

          const rolElement =
            document.querySelector<HTMLInputElement>("input#rolMisCauCiv");

          const yearElement = document.querySelector<HTMLInputElement>(
            "input#anhoMisCauCiv"
          );

          if (ritElement && rolElement && yearElement) {
            ritElement.value = rit;
            rolElement.value = rol;
            yearElement.value = year;
          }
        }

        const search = document.querySelector<HTMLButtonElement>(
          "#btnConsultaMisCauCiv"
        );
        search?.click();
      }, params);
      console.log("Filters cuases active applied");
      await timeout(1500);
    } catch (error) {
      console.log("Error filters");
      throw error;
    }
  }
}
