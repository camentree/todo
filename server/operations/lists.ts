import { sql } from "../database.ts";
import { canonicalName } from "@shared/names.ts";

async function distinctValues(
  column: "list" | "stage" | "who",
): Promise<string[]> {
  const rows = await sql<{ value: string }[]>`
    select distinct ${sql(column)} as value
    from todo.tasks
    where ${sql(column)} is not null and archived_at is null
    order by value
  `;
  return rows.map((row) => row.value);
}

export async function all(): Promise<string[]> {
  return distinctValues("list");
}

export async function stages(): Promise<string[]> {
  return distinctValues("stage");
}

export async function knownWho(): Promise<string[]> {
  return distinctValues("who");
}

export async function tagsOf(list: string | null): Promise<string[]> {
  const rows = await sql<{ tag: string }[]>`
    select distinct unnest(tags) as tag
    from todo.tasks
    where archived_at is null
      ${list ? sql`and list = ${canonicalName(list)}` : sql``}
    order by tag
  `;
  return rows.map((row) => row.tag);
}
