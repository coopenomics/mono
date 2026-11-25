import { GreetingsTables1795546118217 } from './migrations/database/1795546118217-greetings-tables';
import { GreetingsMailings1795585975722 } from './migrations/database/1795585975722-greetings-mailings';
import { GreetingsOutboxIds1795588858293 } from './migrations/database/1795588858293-greetings-outbox-ids';

/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Новую миграцию `pnpm schema:generate` дописывает в этот список.
 */
export const greetingsDatabaseMigrations = [
  GreetingsTables1795546118217,
  GreetingsMailings1795585975722,
  GreetingsOutboxIds1795588858293,
];
