import { computed, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { api, type IVerificationReview, type IVerificationReviewPhoto } from '../api';

/** Как называется состояние проверки на экране и каким цветом его показать. */
export interface VerificationReviewStatusView {
  label: string;
  variant: BaseBadgeVariant;
}

const STATUS_VIEW: Record<string, VerificationReviewStatusView> = {
  [Zeus.VerificationReviewStatus.Pending]: { label: 'На проверке', variant: 'info' },
  [Zeus.VerificationReviewStatus.Approved]: { label: 'Подтверждена', variant: 'pos' },
  [Zeus.VerificationReviewStatus.Rejected]: { label: 'Отклонена', variant: 'neg' },
  [Zeus.VerificationReviewStatus.Revoked]: { label: 'Отозвана', variant: 'neutral' },
};

export function verificationReviewStatusView(status: string): VerificationReviewStatusView {
  return STATUS_VIEW[status] ?? { label: status, variant: 'neutral' };
}

/**
 * Журнал верификаций и решения совета. Сверки, ждущие проверки, идут первыми:
 * пока совет не решил, пайщик уже получает имущество, и очередь — рабочая, а
 * не архивная.
 */
export function useVerificationReviews() {
  const reviews = ref<IVerificationReview[]>([]);
  const loading = ref(false);
  const deciding = ref('');

  const pending = computed(() =>
    reviews.value.filter((review) => review.status === Zeus.VerificationReviewStatus.Pending),
  );

  const load = async (): Promise<void> => {
    try {
      loading.value = true;
      reviews.value = await api.listVerificationReviews();
    } catch (error: any) {
      FailAlert(error);
    } finally {
      loading.value = false;
    }
  };

  const loadPhotos = async (reviewId: string): Promise<IVerificationReviewPhoto[]> => {
    try {
      return await api.getVerificationReviewPhotos(reviewId);
    } catch (error: any) {
      FailAlert(error);
      return [];
    }
  };

  const approve = async (reviewId: string): Promise<boolean> => {
    try {
      deciding.value = reviewId;
      await api.approveVerification({ review_id: reviewId });
      SuccessAlert('Сверка подтверждена. Фотографии удалены');
      await load();
      return true;
    } catch (error: any) {
      FailAlert(error);
      return false;
    } finally {
      deciding.value = '';
    }
  };

  const reject = async (reviewId: string, reason: string): Promise<boolean> => {
    try {
      deciding.value = reviewId;
      await api.rejectVerification({ review_id: reviewId, reason });
      SuccessAlert('Сверка отклонена. Верификация пайщика отозвана');
      await load();
      return true;
    } catch (error: any) {
      FailAlert(error);
      return false;
    } finally {
      deciding.value = '';
    }
  };

  return { reviews, pending, loading, deciding, load, loadPhotos, approve, reject };
}
