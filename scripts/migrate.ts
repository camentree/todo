import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const migrations_directory = new URL("../sql", import.meta.url)
  .pathname;

export async function migrate(): Promise<void> {
  const database_url = process.env.DATABASE_URL;
  if (!database_url) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(database_url);

  await sql`create schema if not exists todo`;
  await sql`
    create table if not exists todo.migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const applied = await sql<{ filename: string }[]>`
    select filename from todo.migrations
  `;
  const already_applied = new Set(applied.map((row) => row.filename));

  const filenames = (await readdir(migrations_directory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of filenames) {
    if (already_applied.has(filename)) {
      continue;
    }
    const statements = await readFile(
      join(migrations_directory, filename),
      "utf8",
    );
    await sql.begin(async (transaction) => {
      await transaction.unsafe(statements);
      await transaction`
        insert into todo.migrations (filename) values (${filename})
      `;
    });
    console.log(`applied ${filename}`);
  }

  await sql.end();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await migrate();
}
