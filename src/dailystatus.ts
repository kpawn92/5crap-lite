import { scrapeDaily } from "./causes/daily-status/scrape-daily";
import { CauseCivilUpdater, MongoDatabase } from "./db";
import { envs } from "./plugins";

export const run = async () => {
  await MongoDatabase.connect({
    url: envs.MONGO_URI,
    dbName: envs.MONGO_DB_NAME,
  });

  const rawData = await scrapeDaily({ day: 23, month: 10, year: 2024 });

  await Promise.all(
    rawData.map((cause) =>
      CauseCivilUpdater.replaceOne({ rol: cause.rol }, cause, { upsert: true })
    )
  );

  console.log("Proccess daily query finally...");
  process.exit();
};

run();
