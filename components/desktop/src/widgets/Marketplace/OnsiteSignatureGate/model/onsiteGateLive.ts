import { registerLiveReload } from 'src/shared/lib/realtime';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { useOnsiteSignatureGate } from './useOnsiteSignatureGate';

let registered = false;

/**
 * Гейт подписи на месте живёт по общей ленте изменений (C28-83): заказ готов к
 * получению, приёмка ждёт подписи поставщика, решение по пополнению склада —
 * всё это изменения таблиц Стола заказов, и гейт перечитывает свои ожидающие
 * подписи по их сигналу. Прежняя отдельная подписка `marketplaceEvents` снята.
 * Регистрируется один раз при установке расширения.
 */
export function registerOnsiteGateLive(): void {
  if (registered) return;
  registered = true;
  registerLiveReload(marketLiveTables('order', 'reception', 'stock'), () =>
    // i18n-ignore: внутренний технический тег причины перечитывания, не текст интерфейса
    useOnsiteSignatureGate().refresh('лента изменений'),
  );
}
