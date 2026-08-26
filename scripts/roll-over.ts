import { sql } from "../server/database.ts";
import { rollOver } from "../server/operations/recurring.ts";

await rollOver();
await sql.end();
