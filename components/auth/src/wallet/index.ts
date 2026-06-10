/**
 * Кошелёк: доступ к расшифрованному ключу в памяти и ротация ключа.
 * Desktop-кошелёк переезжает на этот модуль (миграция — Эпик 7).
 */
import { notImplemented } from '../errors'

export interface Wallet {
  /** Имя COOPOS-аккаунта пайщика */
  account: string
  publicKey: string
}

/** Кошелёк текущей сессии (после login + расшифровки vault). Story 2.2. */
export async function getWallet(): Promise<Wallet> {
  notImplemented('getWallet')
}

/** Ротация ключа пайщика (updateauth + перешифровка vault). Story 3.3. */
export async function rotateKey(): Promise<void> {
  notImplemented('rotateKey')
}
