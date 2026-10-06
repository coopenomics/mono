import { EdubridgeBaseline1790236885856 } from './migrations/database/1790236885856-baseline';
import { EdubridgeAssignmentWithoutAnnex1790834774344 } from './migrations/database/1790834774344-assignment-without-annex';
import { EdubridgeTeacherProfile1790951823745 } from './migrations/database/1790951823745-teacher-profile';
import { EdubridgeEnrollmentClosePending1791201397413 } from './migrations/database/1791201397413-enrollment-close-pending';
import { EdubridgeContractDocument1791201979422 } from './migrations/database/1791201979422-contract-document';
import { EdubridgeGuaranteeClaims1791203803222 } from './migrations/database/1791203803222-guarantee-claims';
import { EdubridgeAssignmentHourlyRate1791290272066 } from './migrations/database/1791290272066-assignment-hourly-rate';
/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Объявляются в записи реестра (`databaseMigrations`) рядом с
 * сущностями, и файлы лежат здесь же: вынесенное расширение уносит историю
 * своих таблиц с собой. Новую миграцию `pnpm schema:generate` дописывает сюда.
 */
export const edubridgeDatabaseMigrations = [EdubridgeBaseline1790236885856, EdubridgeAssignmentWithoutAnnex1790834774344, EdubridgeTeacherProfile1790951823745, EdubridgeEnrollmentClosePending1791201397413, EdubridgeContractDocument1791201979422, EdubridgeGuaranteeClaims1791203803222, EdubridgeAssignmentHourlyRate1791290272066];
