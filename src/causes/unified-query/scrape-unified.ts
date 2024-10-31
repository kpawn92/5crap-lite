import { FileSystemService, ScrapService } from "../../plugins";
import { UnifiedFilters, UnifiedQuery } from "./unified-query";

export const scrapeUnified = async (filters: UnifiedFilters) => {
  const scrape = new ScrapService();
  const storage = new FileSystemService();
  const unifiedQuery = new UnifiedQuery(scrape, storage);

  await unifiedQuery.factory(filters);
  return unifiedQuery.getccivil();
};
