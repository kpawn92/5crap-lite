import { cause } from "./causes";
import { DEFAULT_TIMEOUT_PROCESS } from "./causes/helpers/const";
import { CauseCivil, MongoDatabase } from "./db";
import { envs } from "./plugins";

const scrapCivilOne = async (rol: string) => {
  try {
    console.log("Capture the details one civil cause initialized...");

    await MongoDatabase.connect({
      url: envs.MONGO_URI,
      dbName: envs.MONGO_DB_NAME,
    });
    // process.exit();

    const collect = await cause.getCivilCauseDetail(rol);

    if (cause.hasReplaceCivilDetail) {
      await CauseCivil.replaceOne({ rol }, cause.getCivilDetailReplacement());
    } else {
      await CauseCivil.insertMany(collect);
      console.log("Collect saved");
    }

    console.log("Process finish");
    // process.exit();
  } catch (error) {
    console.error(error);
    process.exit();
  } finally {
    const timeout = setTimeout(() => {
      console.log("Closing of the process...");
      process.exit(0);
    }, DEFAULT_TIMEOUT_PROCESS);

    timeout.unref();
  }
};

scrapCivilOne("C-2622-2024");
