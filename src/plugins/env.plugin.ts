import * as env from "env-var";
import { resolve } from "node:path";
import * as dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: resolve(__dirname, "../../.env") });
}

export const envs = {
  RUT: env.get("RUT").required().asString(),
  BROWSER_HEADLESS: env.get("BROWSER_HEADLESS").required().asBool(),
  PASS: env.get("PASS").required().asString(),
  MONGO_URI: env.get("MONGO_URI").required().asUrlString(),
  MONGO_USER: env.get("MONGO_USER").asString(),
  MONGO_PASS: env.get("MONGO_PASS").asString(),
  MONGO_DB_NAME: env.get("MONGO_DB_NAME").required().asString(),
  NODE_ENV: env.get("NODE_ENV").default("development").asString(),
};
