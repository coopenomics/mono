import { CapitalBaseline1790197276752 } from './migrations/database/1790197276752-baseline';
import { CapitalAssetAmountsAsText1790966897678 } from './migrations/database/1790966897678-asset-amounts-as-text';
import { CapitalMirrorCreatedAtOptional1790971648531 } from './migrations/database/1790971648531-mirror-created-at-optional';
import { CapitalDropGithubCommCursors1791180505721 } from './migrations/database/1791180505721-drop-github-comm-cursors';

/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Объявляются в записи реестра (`databaseMigrations`) рядом с
 * сущностями, и файлы лежат здесь же: вынесенное расширение уносит историю
 * своих таблиц с собой. Новую миграцию `pnpm schema:generate` дописывает сюда.
 */
export const capitalDatabaseMigrations = [CapitalBaseline1790197276752,
  CapitalAssetAmountsAsText1790966897678,
  CapitalMirrorCreatedAtOptional1790971648531, CapitalDropGithubCommCursors1791180505721];
