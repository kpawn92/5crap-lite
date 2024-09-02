import { FileSystemService, ScrapService } from "../plugins";
import { Cause } from "./cause";
import { CivilCauseRolCollectScrape } from "./civil-cause-rol.collect";
import { CivilCauseActiveScrape } from "./civil-cause.active";

const scrape = new ScrapService();
const fileService = new FileSystemService();

const civilCauseActiveScrape = new CivilCauseActiveScrape(scrape);
const civilCauseRolCollectScrape = new CivilCauseRolCollectScrape(
  scrape,
  fileService
);

const cause = new Cause(civilCauseActiveScrape, civilCauseRolCollectScrape);

export { cause };
