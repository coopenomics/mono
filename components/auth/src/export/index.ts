/**
 * Экспорт удостоверения. QR — Vision-stub: фиксирует публичную поверхность,
 * реализация за пределами MVP.
 */
import { notImplemented } from '../errors'

/** Экспорт participant_certificate в QR (Vision). */
export async function exportToQR(_certificate: string): Promise<Uint8Array> {
  notImplemented('exportToQR')
}
