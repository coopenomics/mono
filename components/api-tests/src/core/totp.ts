/**
 * Код TOTP (RFC 6238: SHA-1, шаг 30 с, 6 цифр) — так его считает приложение
 * пайщика. Секрет приходит base32 из ответа подключения второго фактора.
 */
import crypto from 'node:crypto'

function base32Decode(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of secret.toUpperCase().replace(/=+$/, '').replace(/\s/g, ''))
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

export function totp(secret: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(nowSec / 30)))
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0F
  const binary = ((digest[offset] & 0x7F) << 24) | ((digest[offset + 1] & 0xFF) << 16) | ((digest[offset + 2] & 0xFF) << 8) | (digest[offset + 3] & 0xFF)
  return (binary % 1_000_000).toString().padStart(6, '0')
}
