export * from './auth'
export * from './chain'
export * from './client'
export * from './documents'
export * from './env'
export * from './participants'
export * from './robot'
export * from './roles'
export * from './wait'
export * from './wallet'

/**
 * Имя теста со ссылкой на случай реестра (test-registry/<фича>.yaml): по
 * отчёту прогона видно, какой случай упал, без поиска по тексту.
 */
export function caseName(id: string, title: string): string {
  return `[${id}] ${title}`
}
