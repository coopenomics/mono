/**
 * Миграции схемы конфига расширения «Вычислительные ресурсы»: явный, упорядоченный список.
 *
 * Порядок здесь — порядок применения. Раньше он задавался двумя десятками
 * строк в модуле ядра, то есть ядро знало про версии чужих конфигов; теперь
 * DDL расширения едет вместе с самим расширением, как и его таблицы.
 */
import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';

import { powerupSchemaV2Migration } from './migrations/powerup-schema-v2.migration';

export const powerupMigrations: IExtensionSchemaMigration[] = [
  powerupSchemaV2Migration,
];
