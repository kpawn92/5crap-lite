import { scrapeUnified } from "./causes/unified-query/scrape-unified";
import { CauseCivil, MongoDatabase } from "./db";
import { envs } from "./plugins";

async function run() {
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
  process.exit();
}

run();
