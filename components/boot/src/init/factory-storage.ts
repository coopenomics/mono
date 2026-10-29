/**
 * Генератор фабрики документов, подключённый к хранилищу стенда — базе
 * PostgreSQL узла по POSTGRES_*. Один путь на все сидеры boot: данные
 * кооператива лежат в той базе, которую читает контроллер.
 */
import { Generator, PostgresFactoryStorage } from '@coopenomics/docs-factory'

/* eslint-disable node/prefer-global/process */
export async function connectGenerator(): Promise<Generator> {
  const generator = new Generator()
  await generator.connect(new PostgresFactoryStorage({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  }))
  return generator
}
/* eslint-enable node/prefer-global/process */
