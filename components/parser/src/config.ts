import dotenv from 'dotenv'
import type { IActionConfig } from './Types'

dotenv.config()

function getEnvVar(key: string): string {
  const envVar = process.env[key]
  if (envVar === undefined)
    throw new Error(`Env variable ${key} is required`)

  return envVar
}
export const node_env = getEnvVar('NODE_ENV')
export const eosioApi = getEnvVar('API')
export const shipApi = getEnvVar('SHIP')
export const mongoUri = `${getEnvVar('MONGO_EXPLORER_URI')}${node_env === 'test' ? '-test' : ''}`
export const startBlock = getEnvVar('START_BLOCK')
export const finishBlock = getEnvVar('FINISH_BLOCK')
export const redisPort = getEnvVar('REDIS_PORT')
export const redisHost = getEnvVar('REDIS_HOST')
export const redisPassword = getEnvVar('REDIS_PASSWORD')
export const redisStreamLimit = Number(getEnvVar('REDIS_STREAM_LIMIT'))
// --------------------------
export const subscribedContracts: string[] = [
  'draft',
  'meet',
  'soviet',
  'registrator',
  'eosio.token',
  'capital',
  'wallet',
  'ledger',
  'ledger2',
  'marketplace',
]

// Автоматически генерируем действия для всех контрактов из списка
export const subsribedActions: IActionConfig[] = subscribedContracts.map(contract => ({
  code: contract,
  action: '*' as const,
}))

// --------------------------
