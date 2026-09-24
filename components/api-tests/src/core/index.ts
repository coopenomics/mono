export * from './auth'
export * from './chain'
export * from './client'
export * from './env'
export * from './participants'
export * from './roles'
export * from './wait'

/**
 * Имя теста со ссылкой на случай реестра (test-registry/<фича>.yaml): по
 * отчёту прогона видно, какой случай упал, без поиска по тексту.
 */
export function caseName(id: string, title: string): string {
  return `[${id}] ${title}`
}
