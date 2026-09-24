/**
 * Применить миграции схемы — и только их (C28-79).
 *
 *   pnpm schema:migrate                    — база кооператива из конфига
 *   pnpm schema:migrate --database <база>  — указанная база
 *
 * Нужна там, где таблицы должны появиться раньше приложения: boot стенда
 * засевает пользователей и хранилище ключей в уже созданную схему. Миграции
 * данных и цепи здесь не идут — их запускает `pnpm migrate`.
 */
import './schema-tools';
import { runDatabaseMigrations } from '~/migrator/database-migrations';

async function main() {
  const index = process.argv.indexOf('--database');
  const applied = await runDatabaseMigrations(index > -1 ? process.argv[index + 1] : undefined);
  process.stdout.write(`Применено миграций схемы: ${applied.length}\n`);
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
