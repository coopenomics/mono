export type IndexPosition = 'primary' |
  'secondary' |
  'tertiary' |
  'quaternary' |
  'quinary' |
  'senary' |
  'septenary' |
  'octonary' |
  'nonary' |
  'denary'

export interface BlockchainConfig {
  chain_url: string
  chain_id: string
  /**
   * Наблюдатель отказов узла. Получает разобранный ответ цепи целиком — с кодом
   * исключения и подробностями, которые `session.transact` дальше стирает.
   * Не задан — отказы просто не журналируются.
   */
  onChainFailure?: (failure: import('../../utils/chainFetch').ChainFailure) => void
}
