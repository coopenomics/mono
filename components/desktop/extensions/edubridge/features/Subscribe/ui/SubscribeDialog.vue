<template lang="pug">
BaseDialog(:model-value="modelValue" title="Получить доступ" size="md" @update:model-value="(v) => emit('update:modelValue', v)")
  .q-gutter-md
    BaseSelect(v-model="learnerId" label="Обучающийся" :options="learnerOptions" required)
    BaseSelect(v-model="courseId" label="Курс" :options="courseOptions" :disabled="Boolean(lockedCourseId)" required)
    BaseSelect(v-model="period" label="Период членского взноса" :options="periodOptions" required)

    template(v-if="quote")
      DataRow(label="Членский взнос" :value="formatAsset2Digits(quote.amount)")
      DataRow(label="Доступно паевого в главном кошельке" :value="formatAsset2Digits(quote.available)")
      DataRow(:label="quote.is_extension ? 'Будет продлено до' : 'Будет оплачено до'" :value="formatDate(quote.paid_until)")

      BaseBanner(v-if="!quote.enough" variant="warn")
        template(#icon)
          q-icon(name="account_balance_wallet")
        | Не хватает {{ formatAsset2Digits(quote.shortfall) }}. Пополните паевой взнос в главном кошельке — после зачисления вернитесь сюда.
        .q-mt-sm
          BaseButton(variant="secondary" size="sm" @click="goToWallet") Пополнить кошелёк

      template(v-else)
        BaseCheckbox(:model-value="agreed" block :disabled="busy" @update:model-value="(v) => (agreed = v)")
          | Я подписываю&nbsp;
          span.edu-sub__link(@click.stop="openStatement") заявление о конвертации паевого взноса в членский
          |  на сумму {{ formatAsset2Digits(quote.amount) }}.

  template(#footer)
    BaseButton(variant="ghost" :disabled="busy" @click="emit('update:modelValue', false)") Отменить
    BaseButton(variant="primary" :disabled="!quote?.enough || !agreed" :loading="busy" @click="submit") Подписать и получить доступ

  BaseDialog(v-model="statementOpen" title="Заявление о конвертации" size="xl" maximized)
    CardListSkeleton(v-if="!statementHtml" :count="1")
    //- eslint-disable-next-line vue/no-v-html
    div.statement(v-else v-html="statementHtml")
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBanner, BaseButton, BaseCheckbox, BaseDialog, BaseSelect, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import type { DigitalDocument } from 'src/shared/lib/document';
import { fetchQuote, PERIOD_LABELS, type IEnrollment, type ILearner, type IQuote } from '../../../entities/Learner';
import type { ICatalogCourse } from '../../../entities/Course';
import { buildConvertStatement, subscribe } from '../api';

/**
 * «Получить доступ»: выбор обучающегося, курса и периода → котировка → при
 * нехватке паевого — к пополнению средствами ядра; при достатке — заявление
 * о конвертации, подпись, одна транзакция кооператива.
 */
const props = defineProps<{
  modelValue: boolean;
  learners: ILearner[];
  courses: ICatalogCourse[];
  lockedCourseId?: string | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; subscribed: [enrollment: IEnrollment] }>();

const route = useRoute();
const router = useRouter();

const learnerId = ref<string | null>(null);
const courseId = ref<string | null>(props.lockedCourseId ?? null);
const period = ref<Zeus.EduEnrollmentPeriod>(Zeus.EduEnrollmentPeriod.MONTH);
const quote = ref<IQuote | null>(null);
const agreed = ref(false);
const busy = ref(false);
const statementOpen = ref(false);
const statementHtml = ref('');
const statement = ref<DigitalDocument | null>(null);

const learnerOptions = computed(() => props.learners.map((l) => ({ value: l.id, label: l.display_name })));
const courseOptions = computed(() => props.courses.map((c) => ({ value: c.id, label: `${c.title} · ${c.subject}, ${c.grade}` })));
const periodOptions = Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label }));
const courseTitle = computed(() => props.courses.find((c) => c.id === courseId.value)?.title ?? '');

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('ru-RU');
}

watch([learnerId, courseId, period], async () => {
  quote.value = null;
  agreed.value = false;
  statement.value = null;
  statementHtml.value = '';
  if (!learnerId.value || !courseId.value) return;
  try {
    quote.value = await fetchQuote({ learner_id: learnerId.value, course_id: courseId.value, period: period.value });
  } catch (e) {
    FailAlert(e);
  }
});

watch(
  () => props.lockedCourseId,
  (v) => {
    if (v) courseId.value = v;
  },
);

async function ensureStatement(): Promise<DigitalDocument> {
  if (statement.value) return statement.value;
  if (!quote.value) throw new Error('Нет котировки');
  const doc = await buildConvertStatement(quote.value, courseTitle.value, period.value);
  statement.value = doc;
  statementHtml.value = doc.data?.html ?? '';
  return doc;
}

async function openStatement(): Promise<void> {
  statementOpen.value = true;
  try {
    await ensureStatement();
  } catch (e) {
    FailAlert(e);
  }
}

function goToWallet(): void {
  void router.push({ name: 'wallet', params: { coopname: route.params.coopname } });
}

async function submit(): Promise<void> {
  if (!learnerId.value || !courseId.value) return;
  busy.value = true;
  try {
    const doc = await ensureStatement();
    const enrollment = await subscribe({ learner_id: learnerId.value, course_id: courseId.value, period: period.value }, doc);
    SuccessAlert('Членский взнос внесён, доступ оформляется');
    emit('subscribed', enrollment);
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.edu-sub__link {
  color: var(--p-primary);
  text-decoration: underline;
  cursor: pointer;
}
</style>
