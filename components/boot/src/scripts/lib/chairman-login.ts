/**
 * Вход председателя в контроллер для фаз засева.
 *
 * Подписью ключа — пока у председателя нет пароля. Стенд документации ставит
 * ему пароль до сценариев (вход со стола иначе не работает), и после этого
 * вход подписью сервер закрывает (AUTH_PASSWORD_SET_KEY_LOGIN_DISABLED). Тогда
 * токен берётся из файла `API_TOKENS_FILE` — его выписывает харнесс из сессии
 * стола (docs-harness lib/tokens.mjs). Продлевать этот токен нельзя: сервер
 * гасит прежнюю пару, и стол теряет вход посреди сценария.
 */
import fs from 'node:fs'
import type { Client } from '@coopenomics/sdk'

export async function loginChairman(client: Client, email: string, wif: string, account = 'ant'): Promise<void> {
  try {
    await client.login(email, wif)
    return
  }
  catch (e) {
    const file = process.env.API_TOKENS_FILE
    const stored = file && fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, { access?: string }>)[account]
      : undefined
    if (!stored?.access) throw e
    console.error(`[chairman-login] вход подписью закрыт (${(e as Error).message.slice(0, 80)}) — токен из ${file}`)
    client.setToken(stored.access)
  }
}
