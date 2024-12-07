import { FileSystemService, ScrapService } from "../../plugins";
import { CauseCivilPrimitives } from "../civil-cause.types";
import { Daily, FiltersDaily } from "./daily";

type Repository = (ccvivils: CauseCivilPrimitives[]) => Promise<void>;

export const scrapeDaily = async (
  filters: FiltersDaily,
  repository: Repository
) => {
  const scrape = new ScrapService();
  const storage = new FileSystemService();
  const daily = new Daily(scrape, storage);

  await scrape.init();
  await daily.rawData(filters);
  await repository(daily.ccivils);
  await daily.collectDocuments();
};
