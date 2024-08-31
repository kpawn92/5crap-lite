import mongoose from "mongoose";

interface Options {
  url: string;
  dbName: string;
}

export class MongoDatabase {
  static async connect(options: Options) {
    const { url, dbName } = options;

    try {
      await mongoose.connect(url, {
        dbName,
      });

      console.log("Mongo connected!");
    } catch (error) {
      console.log("Mongo connect error");
      throw error;
    }
  }
}
