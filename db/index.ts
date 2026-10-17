import { env } from '../server/runtime';
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {

  return drizzle(env.DB, { schema });
}
