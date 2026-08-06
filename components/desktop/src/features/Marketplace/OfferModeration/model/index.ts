import { ref } from 'vue';
import { Dialog } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { approveOffer, rejectOffer, setOfferWarranty } from '../api';

/** Проверка ввода срока в днях: целое неотрицательное число. */
function isValidDays(val: string): boolean {
  const n = Number(val);
  return val.trim().length > 0 && Number.isInteger(n) && n >= 0;
}

/** Минимум, нужный для подтверждающих диалогов модерации. */
export interface OfferModerationTarget {
  id: string;
  product_name: string;
  /**
   * Срок годности (скоропорт) в днях, задан поставщиком при создании
   * предложения. Показывается при одобрении — модератор ориентируется на
   * него, назначая гарантийный срок возврата (оба поля разные, но
   * гарантийный срок обычно не должен превышать срок годности).
   */
  shelf_life_days?: number;
}

export interface UseOfferModerationOptions {
  /** Вызывается после успешного одобрения (убрать из ленты / обновить статус). */
  onApproved?: (offerId: string) => void;
  /** Вызывается после успешного отклонения. */
  onRejected?: (offerId: string) => void;
  /** Вызывается после изменения гарантийного срока возврата. */
  onWarrantyChanged?: (offerId: string) => void;
}

/**
 * Эпик 3 / Story 3.6: подтверждающие диалоги модерации предложения + мутации.
 *
 * Единая логика для ленты модерации (per-card) и полной страницы предложения
 * на столе администратора (per-page) — DRY. Reactive-Set'ы id'шников в работе
 * дают per-offer состояние loading.
 */
export function useOfferModeration(opts: UseOfferModerationOptions = {}) {
  const approving = ref<Set<string>>(new Set());
  const rejecting = ref<Set<string>>(new Set());
  const settingWarranty = ref<Set<string>>(new Set());

  const isApproving = (id: string): boolean => approving.value.has(id);
  const isRejecting = (id: string): boolean => rejecting.value.has(id);
  const isSettingWarranty = (id: string): boolean => settingWarranty.value.has(id);

  function confirmApprove(offer: OfferModerationTarget): void {
    // При одобрении модератор задаёт гарантийный срок возврата в днях —
    // окно, в течение которого пайщик может вернуть имущество. 0 — возврат
    // по предложению недоступен. Срок годности (скоропорт) поставщик указал
    // отдельно при создании предложения.
    const shelfLifeText =
      offer.shelf_life_days === undefined
        ? ''
        : offer.shelf_life_days > 0
          ? ` Срок годности товара, указанный поставщиком: ${offer.shelf_life_days} дн. — ориентируйтесь на него.`
          : ' Поставщик не указал срок годности (товар без срока годности).';
    Dialog.create({
      title: 'Одобрить предложение?',
      message:
        `«${offer.product_name}» появится в публичном каталоге кооператива. ` +
        'Укажите гарантийный срок возврата (дней): в течение него пайщик сможет ' +
        `вернуть имущество. 0 — возврат недоступен.${shelfLifeText}`,
      prompt: {
        model: '0',
        type: 'number',
        isValid: isValidDays,
        label: 'Гарантийный срок возврата (дней)',
      },
      ok: { label: 'Одобрить', color: 'primary', unelevated: true, noCaps: true },
      cancel: { label: 'Отмена', flat: true, noCaps: true },
      persistent: true,
    }).onOk(async (days: string) => {
      approving.value.add(offer.id);
      try {
        await approveOffer(offer.id, Number(days));
        SuccessAlert(`Предложение «${offer.product_name}» одобрено`);
        opts.onApproved?.(offer.id);
      } catch (e) {
        FailAlert(e);
      } finally {
        approving.value.delete(offer.id);
      }
    });
  }

  /** Изменение гарантийного срока возврата уже одобренного предложения. */
  function confirmSetWarranty(offer: OfferModerationTarget, currentDays = 0): void {
    Dialog.create({
      title: 'Гарантийный срок возврата',
      message: `Укажите гарантийный срок возврата (дней) по «${offer.product_name}». 0 — возврат недоступен.`,
      prompt: {
        model: String(currentDays),
        type: 'number',
        isValid: isValidDays,
        label: 'Гарантийный срок возврата (дней)',
      },
      ok: { label: 'Сохранить', color: 'primary', unelevated: true, noCaps: true },
      cancel: { label: 'Отмена', flat: true, noCaps: true },
      persistent: true,
    }).onOk(async (days: string) => {
      settingWarranty.value.add(offer.id);
      try {
        await setOfferWarranty(offer.id, Number(days));
        SuccessAlert(`Гарантийный срок возврата по «${offer.product_name}» обновлён`);
        opts.onWarrantyChanged?.(offer.id);
      } catch (e) {
        FailAlert(e);
      } finally {
        settingWarranty.value.delete(offer.id);
      }
    });
  }

  function confirmReject(offer: OfferModerationTarget): void {
    Dialog.create({
      title: 'Отклонить предложение?',
      message: `Укажите причину отказа по «${offer.product_name}» — она будет видна поставщику в «Мои предложения».`,
      prompt: {
        model: '',
        type: 'textarea',
        isValid: (val: string) => val.trim().length > 0,
        label: 'Причина отказа',
        counter: true,
        maxlength: 1000,
      },
      ok: { label: 'Отклонить', color: 'negative', unelevated: true, noCaps: true },
      cancel: { label: 'Отмена', flat: true, noCaps: true },
      persistent: true,
    }).onOk(async (reason: string) => {
      rejecting.value.add(offer.id);
      try {
        await rejectOffer(offer.id, reason.trim());
        SuccessAlert(`Предложение «${offer.product_name}» отклонено`);
        opts.onRejected?.(offer.id);
      } catch (e) {
        FailAlert(e);
      } finally {
        rejecting.value.delete(offer.id);
      }
    });
  }

  return {
    approving,
    rejecting,
    settingWarranty,
    isApproving,
    isRejecting,
    isSettingWarranty,
    confirmApprove,
    confirmReject,
    confirmSetWarranty,
  };
}
