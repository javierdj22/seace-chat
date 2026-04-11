import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Falta DATABASE_URL. Carga tu .env antes de ejecutar este script.");
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  const migrationsFolder = path.resolve("./drizzle");
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");

  if (!fs.existsSync(journalPath)) {
    throw new Error("No existe packages/db/drizzle/meta/_journal.json. Genera migraciones primero.");
  }

  const migrations = readMigrationFiles({ migrationsFolder });

  const existingTables = await sql`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `;

  const hasUserTables = ["account", "session", "user", "verification", "chat", "message", "seace_drafts"]
    .every((name) => existingTables.some((table) => table.tablename === name));

  if (!hasUserTables) {
    throw new Error(
      "La base no parece estar preexistente con el schema de la app. Usa 'pnpm db:migrate' en vez de baseline."
    );
  }

  await sql`
    create schema if not exists drizzle
  `;

  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `;

  const existingMigrationRows = await sql`
    select hash, created_at
    from drizzle.__drizzle_migrations
    order by created_at asc
  `;

  for (const migration of migrations) {
    const alreadyInserted = existingMigrationRows.some(
      (row) =>
        row.hash === migration.hash &&
        Number(row.created_at) === migration.folderMillis
    );

    if (alreadyInserted) {
      console.log(`SKIP: ${migration.folderMillis} ya estaba registrada`);
      continue;
    }

    await sql`
      insert into drizzle.__drizzle_migrations ("hash", "created_at")
      values (${migration.hash}, ${migration.folderMillis})
    `;
    console.log(`OK: baseline registrada ${migration.folderMillis}`);
  }

  const finalRows = await sql`
    select id, hash, created_at
    from drizzle.__drizzle_migrations
    order by created_at asc
  `;

  console.log("\nMigraciones registradas en la base:");
  console.log(JSON.stringify(finalRows, null, 2));

  await sql.end();
}

main().catch(async (error) => {
  console.error(error.message ?? error);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
