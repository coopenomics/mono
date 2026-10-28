/**
 * Генератор фабрики документов, подключённый к хранилищу стенда (шаг 5
 * фабрики v2). Хранилище выбирает та же переменная, что у контроллера:
 * `FACTORY_STORAGE=postgres` — база узла по POSTGRES_*, иначе MongoDB по
 * MONGO_URI. Один выбор на все сидеры boot: данные кооператива лежат в том
 * хранилище, которое читает контроллер.
 */
import { Generator, PostgresFactoryStorage } from '@coopenomics/factory'

/* eslint-disable node/prefer-global/process */
export function factoryOnPostgres(): boolean {
  return process.env.FACTORY_STORAGE === 'postgres'
}

export async function connectGenerator(): Promise<Generator> {
  const generator = new Generator()
  if (factoryOnPostgres()) {
    await generator.connect(new PostgresFactoryStorage({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT || '5432'),
      user: process.env.POSTGRES_USERNAME,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
    }))
    return generator
  }
  const uri = process.env.MONGO_URI
  if (!uri)
    throw new Error('MONGO_URI не задан: хранилище фабрики MongoDB без адреса')
  await generator.connect(uri)
  return generator
}
/* eslint-enable node/prefer-global/process */
