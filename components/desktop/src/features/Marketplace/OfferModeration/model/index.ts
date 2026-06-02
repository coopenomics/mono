import { ref } from 'vue';
import { Dialog } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { approveOffer, rejectOffer } from '../api';

/** Минимум, нужный для подтверждающих диалогов модерации. */
export interface OfferModerationTarget {
  id: string;
  product_name: string;
}

export interface UseOfferModerationOptions {
  /** Вызывается после успешного одобрения (убрать из ленты / обновить статус). */
  onApproved?: (offerId: string) => void;
  /** Вызывается после успешного отклонения. */
  onRejected?: (offerId: string) => void;
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

  const isApproving = (id: string): boolean => approving.value.has(id);
  const isRejecting = (id: string): boolean => rejecting.value.has(id);

  function confirmApprove(offer: OfferModerationTarget): void {
    Dialog.create({
      title: 'Одобрить предложение?',
      message: `«${offer.product_name}» появится в публичном каталоге кооператива.`,
      ok: { label: 'Одобрить', color: 'primary', unelevated: true, noCaps: true },
      cancel: { label: 'Отмена', flat: true, noCaps: true },
      persistent: true,
    }).onOk(async () => {
      approving.value.add(offer.id);
      try {
        await approveOffer(offer.id);
        SuccessAlert(`Предложение «${offer.product_name}» одобрено`);
        opts.onApproved?.(offer.id);
      } catch (e) {
        FailAlert(e);
      } finally {
        approving.value.delete(offer.id);
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

  return { approving, rejecting, isApproving, isRejecting, confirmApprove, confirmReject };
}
