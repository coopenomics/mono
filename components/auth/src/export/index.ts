/**
 * Экспорт удостоверения наружу (QR для Vision/предъявления). В MVP существует
 * только ПОЛНАЯ форма (`full_certificate`) — она несёт PII пайщика, поэтому
 * огорожена двумя барьерами (разблокированный vault + явное согласие).
 *
 * ROADMAP (Growth): анонимная форма `proof_of_membership` — доказательство членства
 * БЕЗ PII, с коротким сроком (`exp ≤ 24ч`). Она появится отдельным методом
 * `exportProofQR()`. В MVP его НЕТ намеренно: пока anonymous-формат не существует,
 * вызвать `exportProofQR()` нельзя (ошибка компиляции) — чтобы по ошибке не выпустить
 * PII-полный сертификат под видом anonymous.
 */
import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { isWalletUnlocked } from '../wallet'

export interface ExportFullQROptions {
  /**
   * Колбэк high-stakes-consent диалога: хост показывает пайщику явное подтверждение
   * («вы экспортируете удостоверение с персональными данными») и резолвит `true`,
   * только если пайщик согласился. `false`/reject → экспорт отклоняется.
   */
  confirm: () => Promise<boolean>
}

/**
 * Экспорт ПОЛНОГО participant_certificate (с PII) для предъявления/QR. Доступен
 * только когда (1) vault разблокирован — экспортирует владелец активной сессии, не
 * случайный держатель запертого устройства; (2) пайщик явно подтвердил high-stakes
 * consent. Возвращает payload-байты удостоверения; кодирование в визуальный QR —
 * на стороне хоста/Vision (SDK кросс-рантайм, QR-рендерер не тянет).
 */
export async function exportFullQR(certificate: string, options: ExportFullQROptions): Promise<Uint8Array> {
  if (!isWalletUnlocked())
    throw new AuthV2Error(AuthV2ErrorCode.WalletLocked, 'Экспорт удостоверения возможен только при разблокированном кошельке')

  const consented = await options.confirm().catch(() => false)
  if (!consented)
    throw new AuthV2Error(AuthV2ErrorCode.ConsentRequired, 'Экспорт удостоверения с персональными данными требует явного подтверждения')

  return new TextEncoder().encode(certificate)
}
