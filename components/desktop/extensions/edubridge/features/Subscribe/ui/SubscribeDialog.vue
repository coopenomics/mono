<template lang="pug">
BaseDialog(:model-value="modelValue" title="Получить доступ" size="md" @update:model-value="(v) => emit('update:modelValue', v)")
  .q-gutter-md
    BaseSelect(v-model="learnerId" label="Обучающийся" :options="learnerOptions" required)
      template(#after)
        BaseButton(variant="ghost" size="sm" icon-only aria-label="Добавить обучающегося" @click="learnerFormOpen = true")
          template(#icon-left)
            q-icon(name="add" size="18px")
    BaseSelect(v-model="courseId" label="Курс" :options="courseOptions" :disabled="Boolean(lockedCourseId)" required)

    //- Два способа внести взнос — рядом, с полными суммами: скидка за взнос
    //- разом видна как разница в рублях. Второй способ есть не у каждого курса.
    .edu-subscribe__options(v-if="monthQuote")
      BaseRadioCard(v-model="period" :value="Zeus.EduEnrollmentPeriod.MONTH" title="Помесячно")
        FeeAmount(:value="monthQuote.amount" size="md" per="в месяц")
        template(v-if="courseQuote" #meta)
          | за {{ monthsLabel }} — {{ formatAsset2Digits(courseQuote.base_amount) }}
      BaseRadioCard(v-if="courseQuote" v-model="period" :value="Zeus.EduEnrollmentPeriod.COURSE" title="За весь курс разом")
        FeeAmount(:value="courseQuote.amount" size="md")
        template(#meta)
          | за {{ monthsLabel }} · меньше на {{ formatAsset2Digits(courseQuote.discount_amount) }}

    template(v-if="quote")
      //- Взнос сначала берётся с кошелька программы: возвращённые средства
      //- идут в дело, а с паевого конвертируется только недостача.
      DataRow(v-if="hasProgramFunds" label="Зачтётся с кошелька программы" :value="formatAsset2Digits(quote.from_program)")
      DataRow(v-if="hasProgramFunds" label="Конвертируется с паевого" :value="formatAsset2Digits(quote.to_convert)")
      DataRow(label="Доступно паевого в главном кошельке" :value="formatAsset2Digits(quote.available)")
      DataRow(:label="quote.is_extension ? 'Будет продлено до' : 'Будет оплачено до'" :value="formatDate(quote.paid_until)")

      BaseBanner(v-if="!quote.enough" variant="warn")
        template(#icon)
          q-icon(name="account_balance_wallet")
        | Не хватает {{ formatAsset2Digits(quote.shortfall) }}. Пополните паевой взнос в главном кошельке — после зачисления вернитесь сюда.
        .q-mt-sm
          BaseButton(variant="secondary" size="sm" @click="goToWallet") Пополнить кошелёк

  template(#footer)
    BaseButton(variant="ghost" :disabled="busy" @click="emit('update:modelValue', false)") Отменить
    BaseButton(variant="primary" :disabled="!quote?.enough" :loading="busy" @click="submit") Получить доступ

  BaseDialog(v-model="learnerFormOpen" title="Новый обучающийся" size="md")
    LearnerForm(:default-self="!pool.length" @saved="onLearnerAdded" @cancel="learnerFormOpen = false")

</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBanner, BaseButton, BaseDialog, BaseRadioCard, BaseSelect } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import type { DigitalDocument } from 'src/shared/lib/document';
import { fetchQuote, type IEnrollment, type ILearner, type IQuote } from '../../../entities/Learner';
import type { ICatalogCourse } from '../../../entities/Course';
import { LearnerForm } from '../../../widgets/LearnerForm';
import { courseMonthsLabel } from '../../../shared/lib/courseMonths';
import { FeeAmount } from '../../../shared/ui/FeeAmount';
import { buildConvertStatement, subscribe } from '../api';

/**
 * «Получить доступ»: выбор обучающегося, курса и способа взноса (помесячно
 * либо разом за весь курс) → котировка → при
 * нехватке паевого — к пополнению средствами ядра; при достатке — кнопка.
 * Заявление о конвертации генерируется и подписывается по нажатию кнопки:
 * галочки и чтения документа здесь нет — это машинерия под капотом, человек
 * видит сумму и срок, а не бланк (замечание владельца 2026-09-03).
 */
const props = defineProps<{
  modelValue: boolean;
  learners: ILearner[];
  courses: ICatalogCourse[];
  lockedCourseId?: string | null;
}>();
const emit = defineEmits<{
  'update:modelValue': [v: boolean];
  subscribed: [enrollment: IEnrollment];
  'learner-added': [learner: ILearner];
}>();

const route = useRoute();
const router = useRouter();

const learnerId = ref<string | null>(null);
const learnerFormOpen = ref(false);
/** Список обучающихся диалога: приходит от страницы, но пополняется прямо здесь. */
const pool = ref<ILearner[]>([...props.learners]);
const courseId = ref<string | null>(props.lockedCourseId ?? null);
const period = ref<Zeus.EduEnrollmentPeriod>(Zeus.EduEnrollmentPeriod.MONTH);
/** Котировки обоих способов: участник сравнивает полные суммы до выбора. */
const monthQuote = ref<IQuote | null>(null);
const courseQuote = ref<IQuote | null>(null);
const quote = computed(() => (period.value === Zeus.EduEnrollmentPeriod.COURSE ? courseQuote.value : monthQuote.value));
const monthsLabel = computed(() => courseMonthsLabel(courseQuote.value?.months));
/** Остаток кошелька программы участвует в оплате — показываем обе части взноса. */
const hasProgramFunds = computed(() => parseFloat(String(quote.value?.from_program ?? '0')) > 0);
const busy = ref(false);
const statement = ref<DigitalDocument | null>(null);

const learnerOptions = computed(() => pool.value.map((l) => ({ value: asText(l.id), label: l.is_self ? `${l.display_name} (я)` : l.display_name })));
const courseOptions = computed(() => props.courses.map((c) => ({ value: asText(c.id), label: `${c.title} · ${c.subject}, ${c.grade}` })));
const courseTitle = computed(() => props.courses.find((c) => c.id === courseId.value)?.title ?? '');

function formatDate(value: unknown): string {
  const input = asDateInput(value);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
}

watch([learnerId, courseId], async () => {
  monthQuote.value = null;
  courseQuote.value = null;
  statement.value = null;
  period.value = Zeus.EduEnrollmentPeriod.MONTH;
  if (!learnerId.value || !courseId.value) return;
  const pair = { learner_id: learnerId.value, course_id: courseId.value };
  try {
    monthQuote.value = await fetchQuote({ ...pair, period: Zeus.EduEnrollmentPeriod.MONTH });
  } catch (e) {
    FailAlert(e);
    return;
  }
  // Взнос разом есть не у каждого курса и не всегда: кооператив может принимать
  // только помесячный, а курс — быть уже оплаченным до конца. Отказ здесь — не
  // ошибка, второй способ просто не показывается.
  if (!props.courses.find((c) => asText(c.id) === courseId.value)?.fee_course) return;
  try {
    courseQuote.value = await fetchQuote({ ...pair, period: Zeus.EduEnrollmentPeriod.COURSE });
  } catch {
    courseQuote.value = null;
  }
});

// Заявление подписано под сумму выбранного способа — при смене способа оно готовится заново.
watch(period, () => {
  statement.value = null;
});

watch(
  () => props.lockedCourseId,
  (v) => {
    if (v) courseId.value = v;
  },
);

/** Обучающийся по умолчанию — сам пайщик: так подписка на себя оформляется в два клика. */
function pickDefaultLearner(): void {
  if (learnerId.value && pool.value.some((l) => asText(l.id) === learnerId.value)) return;
  learnerId.value = asText((pool.value.find((l) => l.is_self) ?? pool.value[0])?.id) || null;
}

watch(
  () => props.learners,
  (list) => {
    pool.value = [...list];
    pickDefaultLearner();
  },
  { immediate: true },
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) pickDefaultLearner();
  },
  { immediate: true },
);

/** Обучающийся, заведённый прямо в диалоге: сразу выбран и отдан странице, чтобы список не расходился. */
function onLearnerAdded(learner: ILearner): void {
  pool.value = [...pool.value.filter((l) => asText(l.id) !== asText(learner.id)), learner];
  learnerId.value = asText(learner.id);
  learnerFormOpen.value = false;
  emit('learner-added', learner);
}

async function ensureStatement(): Promise<DigitalDocument> {
  if (statement.value) return statement.value;
  if (!quote.value) throw new Error('Нет котировки');
  const doc = await buildConvertStatement(quote.value, courseTitle.value, period.value);
  statement.value = doc;
  return doc;
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
.edu-subscribe__options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--p-3);
}
</style>
