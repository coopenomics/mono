<template lang="pug">
q-btn(
  color='accent',
  @click.stop='showDialog = true',
  :loading='loading',
  label="Коммит",
  icon="add",
  :size='mini ? "sm" : "md"',
  :dense="isMobile"
  :disabled='disabled'
)

  q-dialog(v-model='showDialog', @hide='clear')
    ModalBase(:title='"Зафиксировать взнос"')
      Form.create-commit-form(
        :class='isMobile ? "q-pb-md" : "q-pb-lg"',
        :handler-submit='handleCreateCommit',
        :is-submitting='isSubmitting',
        :button-submit-txt='"Зафиксировать"',
        :button-cancel-txt='"Отмена"',
        @cancel='clear'
      )
        .create-commit-dialog-content.column.q-gutter-y-sm
          section.create-commit-block
            .column.q-gutter-y-sm
              .create-commit-kv
                .text-caption.text-grey-7 Компонент проекта
                .text-body1.text-weight-medium.text-primary {{ projectLabel }}
              .create-commit-kv
                .text-caption.text-grey-7 Время
                .text-body1.text-weight-medium
                  | {{ formatHours(formData.creator_hours) }}
              .create-commit-kv(v-if='commitCostFormatted')
                .text-caption.text-grey-7 Себестоимость
                .text-body1.text-weight-medium.text-primary {{ commitCostFormatted }}
                .text-caption.text-grey-6.q-pl-sm {{ commitCostCaption }}
              .create-commit-kv(v-else-if='contributorStore.self')
                .text-caption.text-grey-7 Себестоимость
                .text-body2.text-grey-6 Ставка в час не задана — сумму посчитать нельзя.
              template(v-if='commitBreakdown?.tail && commitBreakdown.tail > 1e-6')
                q-separator(color='grey-5', style='opacity: 0.35')
                .text-caption.text-grey-7
                  | После фиксации в накоплении останется {{ formatHours(commitBreakdown.tail) }}.

          section.create-commit-block
            .column.q-gutter-y-md
              .row.items-center.q-gutter-x-sm
                span.text-caption.text-grey-7 Удовлетворение результатом
                span.text-body2.text-weight-medium.text-accent
                  | {{ satisfactionLabel }}
              q-rating(
                v-model='formData.satisfaction_stars',
                :max='5',
                :size='isMobile ? "lg" : "md"',
                color-selected='accent'
              )
              q-input(
                v-model='formData.review_text',
                type='textarea',
                autogrow,
                color="accent"
                filled,
                stack-label,
                label='Отзыв (необязательно)',
                placeholder='Например, что сработало хорошо или что стоит учесть дальше…',
                :maxlength='8000',
                counter,
                :input-style='{ minHeight: "96px" }'
              )
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useCreateCommit, type ICreateCommitInput } from '../model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { ModalBase } from 'src/shared/ui/ModalBase';
import { Form } from 'src/shared/ui/Form';
import { useWindowSize } from 'src/shared/hooks';
import { formatHours } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';

const HOURS_EPS = 1e-9;

function parseAssetAmountParts(value: string | undefined | null): { amount: number; symbol: string } {
  if (!value || value === '0') return { amount: 0, symbol: '' };
  const trimmed = value.trim();
  const parts = trimmed.split(/\s+/);
  const sym = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
  const numPart = parts.length > 1 ? parts.slice(0, -1).join(' ') : trimmed;
  const numeric = parseFloat(numPart.replace(/[^\d.-]/g, ''));
  return { amount: Number.isFinite(numeric) ? numeric : 0, symbol: sym };
}

const { isMobile } = useWindowSize();
const props = defineProps<{
  mini?: boolean;
  projectHash?: string;
  /** Название проекта для сводки в диалоге */
  projectTitle?: string;
  uncommittedHours?: number;
  disabled?: boolean;
}>();

const projectLabel = computed(() => {
  const t = props.projectTitle?.trim();
  if (t) return t;
  const h = props.projectHash?.trim();
  return h || '—';
});

const system = useSystemStore();
const session = useSessionStore();
const contributorStore = useContributorStore();
const { createCommit, createCommitInput } = useCreateCommit(props.projectHash, session.username);

const loading = ref(false);
const showDialog = ref(false);
const isSubmitting = ref(false);

const formData = ref({
  creator_hours: 0,
  description: '',
  review_text: '',
  satisfaction_stars: 0,
});

const satisfactionLabel = computed(() => {
  const stars = formData.value.satisfaction_stars;
  return stars > 0 ? `${stars} / 5` : 'не указано';
});

const commitBreakdown = computed(() => {
  const total = formData.value.creator_hours || 0;
  if (total <= HOURS_EPS) return null;
  const chain = Math.floor(total + HOURS_EPS);
  const tail = Math.max(0, total - chain);
  return { total, chain, tail };
});

/** Стоимость выбранных часов: ставка из профиля участника × часы в форме */
const commitCostFormatted = computed(() => {
  const hours = formData.value.creator_hours || 0;
  if (hours <= HOURS_EPS) return '';
  const rateStr = contributorStore.self?.rate_per_hour;
  const { amount: rate, symbol } = parseAssetAmountParts(rateStr);
  if (rate <= 0) return '';
  const raw = rate * hours;
  const assetStr = symbol ? `${raw} ${symbol}` : String(raw);
  return formatAsset2Digits(assetStr);
});

const commitCostCaption = computed(() => {
  const hours = formData.value.creator_hours || 0;
  if (hours <= HOURS_EPS) return '';
  const rateStr = contributorStore.self?.rate_per_hour?.trim();
  if (!rateStr) return '';
  const { amount: rate } = parseAssetAmountParts(rateStr);
  if (rate <= 0) return '';
  return `${formatAsset2Digits(rateStr)} × ${formatHours(hours)}`;
});

// Устанавливаем часы при открытии диалога
watch(showDialog, (isOpen) => {
  if (isOpen) {
    formData.value.creator_hours = props.uncommittedHours || 0;
    formData.value.satisfaction_stars = 0;
    formData.value.review_text = '';
  }
});

const clear = () => {
  showDialog.value = false;
  formData.value = {
    creator_hours: props.uncommittedHours || 0,
    description: '',
    review_text: '',
    satisfaction_stars: 0,
  };
};

const handleCreateCommit = async () => {
  try {
    isSubmitting.value = true;

    const reviewText = formData.value.review_text.trim();
    const stars = formData.value.satisfaction_stars;
    const hasFeedback = stars >= 1 || reviewText.length > 0;

    const commitDataPayload: ICreateCommitInput = {
      coopname: system.info.coopname,
      commit_hours: formData.value.creator_hours,
      project_hash: props.projectHash || createCommitInput.value.project_hash,
      username: session.username || createCommitInput.value.username,
      description: '',
      meta: JSON.stringify({}),
      data: hasFeedback
        ? [
            {
              type: 'contribution_feedback',
              data: {
                review_text: reviewText,
                satisfaction_stars: stars,
              },
            },
          ]
        : [],
    };

    await createCommit(commitDataPayload);

    SuccessAlert('Коммит успешно создан');
    clear();
  } catch (error) {
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.create-commit-form {
  min-width: 0;
}

.create-commit-dialog-content {
  max-width: 520px;
}

.create-commit-block {
  padding: 14px 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--q-primary) 8%, transparent);
}

.body--dark .create-commit-block,
.q-dark .create-commit-block {
  background: color-mix(in srgb, var(--q-primary) 18%, transparent);
}

.create-commit-kv + .create-commit-kv {
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--q-primary) 12%, transparent);
}

.body--dark .create-commit-kv + .create-commit-kv,
.q-dark .create-commit-kv + .create-commit-kv {
  border-top-color: color-mix(in srgb, var(--q-primary) 28%, transparent);
}

/* Кнопки формы — воздух сверху, выравнивание вправо */
.create-commit-form :deep(.q-form > .flex) {
  margin-top: 8px;
  padding-top: 16px;
  justify-content: flex-end;
  gap: 8px;
}
</style>
