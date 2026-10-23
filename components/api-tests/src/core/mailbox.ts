/**
 * Почтовый ящик стенда — перехватчик Mailpit. Письма контроллера (коды,
 * ссылки восстановления) тест читает так же, как пайщик свою почту, а не из
 * журнала контроллера.
 */
import { waitFor } from './wait'

export const MAILPIT_URL = (process.env.MAILPIT_URL || 'http://127.0.0.1:8025').replace(/\/+$/, '')

export interface Mail {
  id: string
  subject: string
  text: string
  html: string
}

/** Последнее письмо на адрес, в тексте которого есть `contains`. */
export async function latestMail(to: string, contains: string, timeoutMs = 60_000): Promise<Mail> {
  return waitFor(async () => {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=20`)
    if (!search.ok)
      return null
    const list: any = await search.json()
    for (const m of list.messages ?? []) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/message/${m.ID}`)
      if (!res.ok)
        continue
      const full: any = await res.json()
      const mail = { id: m.ID, subject: String(full.Subject ?? ''), text: String(full.Text ?? ''), html: String(full.HTML ?? '') }
      if (mail.text.includes(contains) || mail.html.includes(contains))
        return mail
    }
    return null
  }, { timeoutMs, intervalMs: 1_000, label: `письмо на ${to} с «${contains}»` })
}
