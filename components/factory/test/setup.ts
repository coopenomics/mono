import { generator, preLoading, testStorage } from './utils'

/**
 * Глобальная подготовка набора: таблицы хранилища в PostgreSQL и записи
 * кооператива и пайщиков. Фикстуры цепи — в памяти, их кладёт
 * `test/setup-file.ts` перед каждым файлом.
 */
export default async () => {
  console.log('Global setup running...')

  const storage = testStorage()
  await storage.ensureSchema()
  await generator.connect(storage)
  await preLoading()
  console.log('Global setup done.')
}
