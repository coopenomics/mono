import Redis from 'ioredis'
import { redisHost, redisPassword, redisPort } from '../config'

const redis = new Redis({
  port: Number(redisPort),
  host: redisHost,
  password: redisPassword,
})

const streamName = 'notifications'

/**
 * Parser НЕ обрезает stream. XTRIM MAXLEN на стороне producer'а при burst'е
 * удалял сообщения до того, как controller успевал их прочитать —
 * невозвратимая data loss. Trim — ответственность контроллера на основе
 * фактически consumed позиции (см. blockchain-consumer.service.ts:
 * trimConsumedMessages() + XTRIM MINID по first-pending).
 *
 * Итог: parser ТОЛЬКО XADD, без ограничения длины. Controller отвечает
 * за то, чтобы stream не раздувался до бесконечности — он делает XTRIM
 * MINID <first-pending-id> раз в 30 сек. До этой границы — сообщения
 * либо уже ACK'нуты, либо точно не нужны; после неё — pending или
 * будущие, их трогать нельзя.
 */

export async function publishEvent(type: string, event: object) {
  const message = JSON.stringify({ type, event })
  await redis.xadd(streamName, '*', 'event', message)
}

export async function publishDelta(type: string, delta: object) {
  const message = JSON.stringify({ type, delta })
  await redis.xadd(streamName, '*', 'delta', message)
}

export async function publishFork(type: string, block_num: number) {
  const message = JSON.stringify({ type, block_num })
  await redis.xadd(streamName, '*', 'fork', message)
}
