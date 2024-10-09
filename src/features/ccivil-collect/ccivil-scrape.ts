import { CauseCivil, CivilCauseActive } from "../../db";
import { FileSystemService } from "../../plugins";
import { Scrape } from "../../tools/scrape";
import { Filter } from "../shared/filter";
import { DocumentStorage } from "./ccdoc-storage";
import { CivilFailed } from "./ccvil-failed";
import { Civil } from "./civil";
import { CivilCollect } from "./civil-collect";
import { CivilRolDetail } from "./civil-detail";
import { CCDetail } from "./detail";

export const ccivil = async (scrape: Scrape, roles: string[] = []) => {
  const filter = new Filter(scrape);
  const storage = new FileSystemService();

  if (roles.length === 0) {
    await filter.apply();
    const mostRecent = await CivilCauseActive.findOne().sort({
      admissionAt: -1,
    });
    const civilMostRecent = mostRecent ? Civil.instance(mostRecent) : undefined;
    const collect = new CivilCollect(scrape, civilMostRecent);
    await CivilCauseActive.insertMany(await collect.rawData());
    console.log("Collect saved");
  }

  for (const role of roles) {
    await filter.apply({ role });
    const query = await CauseCivil.findOne({ rol: role });
    const record = query ? CCDetail.instance(query) : undefined;
    const ccdetail = new CivilRolDetail(scrape, record);

    const detail = await ccdetail.rawData(async (urls, ccd) => {
      if (ccd.replace) return;

      const ds = new DocumentStorage(scrape, storage, role);
      const failed = await ds.download(urls);

      if (failed.length === 0) return;

      const newAnchors = await ccd.collectAnchors();
      const newURLs = await new CivilFailed(
        scrape,
        failed,
        newAnchors
      ).getNewsURLs();
      await ds.download(newURLs);
    });

    ccdetail.replace
      ? await CauseCivil.replaceOne({ rol: role }, detail)
      : (await CauseCivil.create(detail)).save();
  }
};
