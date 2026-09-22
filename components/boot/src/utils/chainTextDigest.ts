import { createHash } from 'node:crypto'

/**
 * Описание и приглашение проекта capital хранятся в цепи хешем: sha256 текста в
 * шестнадцатеричной записи или пустая строка. Так же считает контроллер
 * (extensions/capital/domain/utils/chain-text-digest.ts), контракт другое не принимает.
 */
export function chainTextDigest(text: string): string {
  if (!text) return ''
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
