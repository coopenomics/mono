/**
 * Адреса стенда. На раннере CI их выставляет scripts/blackbox/stack.sh, на
 * dev-стенде по умолчанию — порты extra_reboot.sh.
 */
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const API_URL = process.env.API_URL || 'http://127.0.0.1:2998/v1/graphql'
export const CHAIN_URL = process.env.CHAIN_URL || 'http://127.0.0.1:8888'
export const COOP = process.env.COOPNAME || 'voskhod'

/** Ключ, который boot выдаёт председателю и членам совета стенда. */
export const DEFAULT_WIF = process.env.TEST_WIF || process.env.EOSIO_PRV_KEY || '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'

export const REPO_ROOT = process.env.REPO_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
