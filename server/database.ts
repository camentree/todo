import postgres from "postgres";

const database_url = process.env.DATABASE_URL;

if (!database_url) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = postgres(database_url, {
  transform: postgres.camel,
  types: {
    bigint: {
      to: 20,
      from: [20],
      serialize: (value: number) => String(value),
      parse: (value: string) => Number(value),
    },
    date: {
      to: 1082,
      from: [1082],
      serialize: (value: string) => value,
      parse: (value: string) => value,
    },
  },
});
