<template lang="pug">
BaseDialog(:model-value="modelValue" :title="$t('edubridge.subscribeDialog.getAccess')" size="lg" @update:model-value="(v) => emit('update:modelValue', v)")
  .q-gutter-md
    BaseSelect(v-model="courseId" :label="$t('edubridge.subscribeDialog.courseLabel')" :options="courseOptions" :disabled="Boolean(lockedCourseId)" required)
    //- Набор идёт в группу: у курса с несколькими открытыми группами участник выбирает свою.
    BaseSelect(v-if="groupOptions.length > 1" v-model="groupId" :label="$t('edubridge.subscribeDialog.groupLabel')" :options="groupOptions" required)

    //- Кто учится — плитками: добавленные обучающиеся, сам пайщик и «другой человек».
    //- Здесь только выбор: себя пайщик добавляет одним нажатием, данные другого
    //- человека вводятся в отдельном окне — второй кнопки «Добавить» в этом окне нет.
    .edu-subscribe__who
      .t-eyebrow.q-mb-sm {{ $t('edubridge.subscribeDialog.whoTitle') }}
      .edu-subscribe__tiles
        BaseRadioCard(v-for="l in pool" :key="asText(l.id)" v-model="who" :value="asText(l.id)" :title="l.is_self ? $t('edubridge.learnerForm.whoSelf') : l.display_name" :disabled="addingSelf")
        BaseRadioCard(v-if="!hasSelf" v-model="who" :value="WHO_SELF" :title="$t('edubridge.learnerForm.whoSelf')" :disabled="addingSelf")
        BaseRadioCard(v-model="who" :value="WHO_OTHER" :title="$t('edubridge.learnerForm.whoOther')" :disabled="addingSelf")

    //- Два способа внести взнос — рядом, с полными суммами: скидка за взнос
    //- разом видна как разница в рублях. Второй способ есть не у каждого курса.
    .edu-subscribe__options(v-if="monthQuote")
      BaseRadioCard(v-model="period" :value="Zeus.EduEnrollmentPeriod.MONTH" :title="$t('edubridge.subscribeDialog.periodMonthTitle')")
        FeeAmount(:value="monthQuote.amount" size="md" :per="$t('edubridge.subscribeDialog.perMonth')")
        template(v-if="courseQuote" #meta)
          | {{ $t('edubridge.subscribeDialog.courseTotalMeta', { months: monthsLabel, amount: formatAsset2Digits(courseQuote.base_amount) }) }}
      BaseRadioCard(v-if="courseQuote" v-model="period" :value="Zeus.EduEnrollmentPeriod.COURSE" :title="$t('edubridge.subscribeDialog.periodCourseTitle')")
        FeeAmount(:value="courseQuote.amount" size="md")
        template(#meta)
          | {{ $t('edubridge.subscribeDialog.courseDiscountMeta', { months: monthsLabel, discount: formatAsset2Digits(courseQuote.discount_amount) }) }}

    template(v-if="quote")
      //- Взнос сначала берётся с кошелька программы: возвращённые средства
      //- идут в дело, а с паевого конвертируется только недостача.
      DataRow(v-if="hasProgramFunds" align="spread" :label="$t('edubridge.subscribeDialog.fromProgramLabel')" :value="formatAsset2Digits(quote.from_program)")
      DataRow(v-if="hasProgramFunds" align="spread" :label="$t('edubridge.subscribeDialog.fromShareLabel')" :value="formatAsset2Digits(quote.to_convert)")
      DataRow(align="spread" :label="$t('edubridge.subscribeDialog.availableShareLabel')" :value="formatAsset2Digits(quote.available)")
      DataRow(v-if="!quote.enough" align="spread" :label="$t('edubridge.subscribeDialog.shortfallLabel')")
        template(#value-override)
          span.edu-subscribe__shortfall {{ formatAsset2Digits(quote.shortfall) }}
      DataRow(align="spread" :label="quote.is_extension ? $t('edubridge.subscribeDialog.extendedUntilLabel') : $t('edubridge.subscribeDialog.paidUntilLabel')" :value="formatDate(quote.paid_until)")


  template(#footer)
    BaseButton(variant="ghost" :disabled="busy" @click="emit('update:modelValue', false)") {{ $t('edubridge.subscribeDialog.cancel') }}
    //- Средств не хватает — главным действием окна становится пополнение на недостающую сумму;
    //- после зачисления расчёт пересчитывается и на этом месте стоит «Получить доступ».
    DepositButton(v-if="quote && !quote.enough" primary :amount="shortfallAmount" :label="$t('edubridge.subscribeDialog.topUpWallet')" @deposited="reloadQuotes")
    BaseButton(v-else variant="primary" :disabled="!quote?.enough" :loading="busy" @click="submit") {{ $t('edubridge.subscribeDialog.getAccess') }}

  BaseDialog(:model-value="Boolean(newLearnerWho)" :title="$t('edubridge.subscribeDialog.newLearnerTitle')" size="md" @update:model-value="(v) => v || cancelNewLearner()")
    LearnerForm(v-if="newLearnerWho" :key="newLearnerWho" :fixed-who="newLearnerWho" @saved="onLearnerAdded" @cancel="cancelNewLearner")
</template>

<script setup lang="ts">
import { fetchOpenGroups, type IGroup } from '../../../entities/Group';
import { computed, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseDialog, BaseRadioCard, BaseSelect } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { DepositButton } from 'src/features/Wallet/DepositToWallet';
import type { DigitalDocument } from 'src/shared/lib/document';
import { addLearner, fetchQuote, type IEnrollment, type ILearner, type IQuote } from '../../../entities/Learner';
import { courseSectionLabel, type ICatalogCourse } from '../../../entities/Course';
import { LearnerForm, selfLearnerInput } from '../../../widgets/LearnerForm';
import { courseMonthsLabel } from '../../../shared/lib/courseMonths';
import { FeeAmount } from '../../../shared/ui/FeeAmount';
import { buildConvertStatement, subscribe } from '../api';
import { t } from '../../../i18n';

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


const learnerId = ref<string | null>(null);
/** Плитка нового обучающегося нажата: открыто окно с его данными, прежний выбор сохранён. */
const WHO_SELF = '__self';
const WHO_OTHER = '__other';
const newLearnerWho = ref<'self' | 'other' | null>(null);
const addingSelf = ref(false);
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

const hasSelf = computed(() => pool.value.some((l) => l.is_self));
const WHO_TILES = { self: WHO_SELF, other: WHO_OTHER };
/** Выбранная плитка: обучающийся из списка либо одна из двух плиток нового. */
const who = computed<string | number>({
  get: () => (newLearnerWho.value ? WHO_TILES[newLearnerWho.value] : (learnerId.value ?? '')),
  set: (v) => void pickWho(String(v)),
});

async function pickWho(value: string): Promise<void> {
  if (value === WHO_OTHER) return startNewLearner('other');
  if (value !== WHO_SELF) {
    newLearnerWho.value = null;
    learnerId.value = value;
    return;
  }
  // Себя пайщик добавляет одним нажатием: имя и почта берутся из учётной записи.
  const own = selfLearnerInput();
  if (!own) return startNewLearner('self');
  addingSelf.value = true;
  try {
    onLearnerAdded(await addLearner(own));
  } catch (e) {
    FailAlert(e);
  } finally {
    addingSelf.value = false;
  }
}

function startNewLearner(kind: 'self' | 'other'): void {
  newLearnerWho.value = kind;
}

/** Окно нового обучающегося закрыто без сохранения — выбор остаётся прежним. */
function cancelNewLearner(): void {
  newLearnerWho.value = null;
}
const courseOptions = computed(() => props.courses.map((c) => ({ value: asText(c.id), label: `${c.title} · ${courseSectionLabel(c.section_title, c.level_title, ', ')}` })));
const courseTitle = computed(() => props.courses.find((c) => c.id === courseId.value)?.title ?? '');

function formatDate(value: unknown): string {
  const input = asDateInput(value);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
}

/** Группы курса с открытым набором; одна — берётся сама, несколько — участник выбирает. */
const openGroups = ref<IGroup[]>([]);
const groupId = ref<string | null>(null);
const groupOptions = computed(() =>
  openGroups.value.map((g) => ({
    value: asText(g.id),
    label: g.starts_at ? t('edubridge.subscribeDialog.groupOption', { title: g.title, startsAt: formatDate(g.starts_at) }) : g.title,
  })),
);

async function loadGroups(): Promise<void> {
  openGroups.value = [];
  groupId.value = null;
  if (!courseId.value) return;
  try {
    openGroups.value = await fetchOpenGroups(courseId.value);
  } catch {
    // Группы не прочитаны — сервер запишет в единственную группу с открытым набором.
    openGroups.value = [];
  }
  if (openGroups.value.length > 1) groupId.value = asText(openGroups.value[0].id);
}

watch(courseId, loadGroups, { immediate: true });
watch([learnerId, courseId, groupId], async () => {
  period.value = Zeus.EduEnrollmentPeriod.MONTH;
  await reloadQuotes();
});

/** Расчёт обоих способов оплаты; зовётся при смене курса или обучающегося и после пополнения кошелька. */
async function reloadQuotes(): Promise<void> {
  monthQuote.value = null;
  courseQuote.value = null;
  statement.value = null;
  if (!learnerId.value || !courseId.value) return;
  const pair = { learner_id: learnerId.value, course_id: courseId.value, group_id: groupId.value };
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
}

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
  newLearnerWho.value = null;
  emit('learner-added', learner);
}

async function ensureStatement(): Promise<DigitalDocument> {
  if (statement.value) return statement.value;
  if (!quote.value) throw new Error(t('edubridge.error.quoteMissing'));
  const doc = await buildConvertStatement(quote.value, courseTitle.value, period.value);
  statement.value = doc;
  return doc;
}

/** Сколько не хватает на главном кошельке — числом, для окна пополнения. */
const shortfallAmount = computed(() => parseFloat(quote.value?.shortfall ?? '') || null);

async function submit(): Promise<void> {
  if (!learnerId.value || !courseId.value) return;
  busy.value = true;
  try {
    const doc = await ensureStatement();
    const enrollment = await subscribe({ learner_id: learnerId.value, course_id: courseId.value, period: period.value, group_id: groupId.value }, doc);
    SuccessAlert(t('edubridge.subscribeDialog.success'));
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
/* Плитки «кто учится» уже плиток взноса: две в ряд помещаются и в узком окне. */
.edu-subscribe__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--p-3);
}
.edu-subscribe__wallet {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2) var(--p-3);
  width: 100%;
}
.edu-subscribe__shortfall {
  color: var(--p-neg);
  font-weight: 600;
}
</style>
