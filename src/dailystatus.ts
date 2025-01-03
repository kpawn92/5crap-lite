import { scrapeDaily } from "./causes/daily-status/scrape-daily";
import { CauseCivilUpdater, MongoDatabase } from "./db";
import { envs } from "./plugins";

export const run = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await MongoDatabase.connect({
      url: envs.MONGO_URI,
      dbName: envs.MONGO_DB_NAME,
    });

    console.log("Starting scrapeDaily process...");
    await scrapeDaily({ day: 23, month: 10, year: 2024 }, async (rawData) => {
      console.log(`Processing ${rawData.length} civil cases...`);
      await Promise.all(
        rawData.map(
          async (cause) =>
            await CauseCivilUpdater.replaceOne({ rol: cause.rol }, cause, {
              upsert: true,
            })
        )
      );
      console.log("Civils cases saved successfully");
    });

    console.log("Process daily query completed.");
  } catch (error) {
    console.error(error);
    process.exit();
  }
};

run();
