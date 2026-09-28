import crypto from 'node:crypto'

/**
 * Адрес получателя уведомлений пайщика — той же формулой, что заводит его
 * контроллер (UserDomainService.generateSubscriberId и utils/subscriber-hash.util):
 * `coopname:32 hex` и HMAC-sha256 на SERVER_SECRET.
 *
 * Boot и фабрика пайщиков стенда пишут users напрямую; без адреса пайщик не
 * получал уведомлений до ночного добора контроллера, и проверки уведомлений на
 * свежих пайщиках были невозможны (решение владельца 25.09.2026, C28-80).
 * Без SERVER_SECRET адрес пустой (умолчание колонки) — его дозаполнит контроллер.
 */
export function subscriberIdentity(coopname: string): { subscriber_id: string, subscriber_hash: string } {
  const secret = process.env.SERVER_SECRET
  if (!secret)
    return { subscriber_id: '', subscriber_hash: '' }
  const subscriber_id = `${coopname}:${crypto.randomBytes(16).toString('hex')}`
  const subscriber_hash = crypto.createHmac('sha256', secret).update(subscriber_id).digest('hex')
  return { subscriber_id, subscriber_hash }
}
