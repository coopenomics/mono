import { Injectable } from '@nestjs/common';
import type { IExtensionDatabasePort, InnerExtensionDatabaseConnection } from '@coopenomics/innercoop';
import config from '~/config/config';

/**
 * Каким расширениям заведена отдельная база.
 *
 * Список ведётся здесь, в composition root: он и есть то самое место, которому
 * позволено знать обе стороны. Расширения нет в списке — оно работает на общем
 * подключении ядра, и это нормальный случай, а не отказ.
 *
 * Сейчас у маркетплейса это то же физическое хранилище, что и у ядра: своё
 * подключение он держит ради собственного набора сущностей, а не ради другой
 * базы. Разъедутся они или сольются в одно — вопрос инфраструктуры, и порт
 * позволяет решить его, не трогая расширение.
 */
const EXTENSION_DATABASES: Readonly<Record<string, InnerExtensionDatabaseConnection>> = {
  marketplace: {
    host: config.postgres.host,
    port: Number(config.postgres.port),
    username: config.postgres.username,
    password: config.postgres.password,
    database: config.postgres.database,
  },
};

/** Реализация `IExtensionDatabasePort`: реквизиты подключения по имени расширения. */
@Injectable()
export class ExtensionDatabaseInnercoopAdapter implements IExtensionDatabasePort {
  getConnection(extensionName: string): InnerExtensionDatabaseConnection | null {
    return EXTENSION_DATABASES[extensionName] ?? null;
  }
}
