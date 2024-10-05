import { cause } from "./causes";
import { CauseCivil, MongoDatabase } from "./db";
import { envs } from "./plugins";

(async () => {
  try {
    console.log("Capture the details one civil cause initialized...");

    await MongoDatabase.connect({
      url: envs.MONGO_URI,
      dbName: envs.MONGO_DB_NAME,
    });

    const collect = await cause.getCivilCauseDetail("C-2622-2024");

    if (cause.hasReplaceCivilDetail) {
      await CauseCivil.replaceOne(
        { rol: cause.rolConsulted },
        cause.getCivilDetailReplacement()
      );
    } else {
      await CauseCivil.insertMany(collect);
      console.log("Collect saved");
    }

    console.log("Process finish");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit();
  }
})();
