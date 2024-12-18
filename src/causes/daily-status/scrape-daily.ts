import { CauseCivilDocument } from "../../db";
import { ScrapService } from "../../plugins";
import { Daily, FiltersDaily } from "./daily";

type Repository = (ccvivils: CauseCivilDocument[]) => Promise<void>;

export const scrapeDaily = async (
  filters: FiltersDaily,
  repository: Repository
) => {
  const scrape = new ScrapService();
  const daily = new Daily(scrape);

  await scrape.init();
  await daily.rawData(filters);
  await repository(daily.ccivils);
  await daily.collectDocuments();
};
