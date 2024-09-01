import { Cause } from "./causes/cause";
import { CivilCauseScrap } from "./causes/civil-cause.scrap";
import { CauseCivil, MongoDatabase } from "./db";
import { envs, FileSystemService, ScrapService } from "./plugins";

(async () => {
  try {
    console.log("Scrap initialized");
    await MongoDatabase.connect({
      url: envs.MONGO_URI,
      dbName: envs.MONGO_DB_NAME,
    });

    const scrap = new ScrapService();
    const file = new FileSystemService();
    const civilScrap = new CivilCauseScrap(scrap, file);

    const cause = new Cause(civilScrap);
    const civils = await cause.getAllCivils();

    await CauseCivil.insertMany(civils);
  } catch (error) {
    console.error(error);
    process.exit();
  }
})();
