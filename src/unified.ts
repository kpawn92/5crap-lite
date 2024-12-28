import { DEFAULT_TIMEOUT_PROCESS } from "./causes/helpers/const";
import { scrapeUnified } from "./causes/unified-query/scrape-unified";
import { CauseCivil, MongoDatabase } from "./db";
import { envs } from "./plugins";

async function run() {
  try {
    await MongoDatabase.connect({
      url: envs.MONGO_URI,
      dbName: envs.MONGO_DB_NAME,
    });

    const rol = "C-2624-2024";
    const rawData = await scrapeUnified({
      court: "Concep",
      tribune: "Juzgado Civil",
      rol,
    });

    await CauseCivil.findOneAndReplace({ rol }, rawData, {
      upsert: true,
    });
    console.log("Civil cause remplaced...");

    console.log("Proccess finally");
  } catch (error) {
    console.error(error);
  } finally {
    const timeout = setTimeout(() => {
      console.log("Closing of the process...");
      process.exit(0);
    }, DEFAULT_TIMEOUT_PROCESS);

    timeout.unref();
  }
}

run();
