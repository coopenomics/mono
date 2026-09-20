<template lang="pug">
BaseForm.edu-course-form(ref="formEl" :loading="loading" :error="error" @submit="submit")
  //- Форма идёт разделами сверху вниз, поля — в одну колонку с подсказкой под
  //- каждым: так читается, что от чего зависит. Пары коротких полей встают
  //- рядом только когда места хватает, поэтому подсказки не обрезаются.
  section.edu-course-form__section
    .edu-course-form__legend Курс
    BaseInput(v-model="form.title" label="Название курса" hint="Как курс увидят в каталоге" required)
    .edu-course-form__pair
      BaseInput(v-model="form.subject" label="Предмет" required)
      BaseInput(v-model="form.grade" label="Класс" placeholder="7 класс" required)
    BaseInput(v-model="form.schedule" label="Расписание" placeholder="Вт, Чт 17:00–18:30" hint="Дни и время занятий — строкой, как их видит ученик")
    BaseInput(v-model="form.description" label="Описание" type="textarea" :rows="3" autogrow)
    BaseInput(v-model="form.syllabus" label="Учебная программа" type="textarea" :rows="5" autogrow)

  section.edu-course-form__section
    .edu-course-form__legend Обложка
    //- Обложка во всю ширину: снимок виден в тех же пропорциях, что и в каталоге,
    //- замена с удалением открываются наведением на него.
    .edu-course-form__cover(v-if="previewUrl")
      q-img(:src="previewUrl" :ratio="21 / 9" fit="cover" no-spinner)
      .edu-course-form__cover-actions
        BaseButton(variant="secondary" size="sm" type="button" @click="pickImage") Заменить
        BaseButton(variant="ghost" size="sm" type="button" @click="removeImage") Убрать
    .edu-course-form__picker(v-else role="button" tabindex="0" @click="pickImage" @keydown.enter="pickImage")
      q-icon(name="add_photo_alternate" size="24px")
      .t-sm.text-weight-medium Загрузить обложку
      .t-meta.t-muted JPEG, PNG или WEBP до 10 МБ
    input.edu-course-form__file(ref="fileInput" type="file" :accept="COURSE_IMAGE_ACCEPT" @change="onFilePicked")

  //- Взнос не вводится руками: он складывается из часов занятий по ставке
  //- преподавателя и наценки кооператива. Так оплата ученика покрывает
  //- обязательства перед теми, кто курс ведёт.
  section.edu-course-form__section
    .edu-course-form__legend Стоимость
    .edu-course-form__pair
      BaseInput(v-model="lessonsPerMonth" label="Занятий в месяц" type="number" hint="По расписанию курса" required)
      BaseInput(v-model="lessonMinutes" label="Занятие, минут" type="number" hint="Длительность одного занятия" required)
    .edu-course-form__pair
      BaseInput(v-model="lessonsTotal" label="Занятий в программе" type="number" hint="Всего занятий курса" required)
      BaseInput(v-model="plannedRate" label="Ставка часа" type="number" :suffix="symbol" hint="Плановая ставка преподавателя" required)
    .edu-course-form__pair
      BaseInput(
        v-model="form.starts_at"
        label="Дата начала занятий"
        type="date"
        stack-label
        hint="До этой даты ученик отменяет подписку с полным возвратом"
      )
      BaseInput(
        v-model="guaranteeDays"
        label="Гарантия материалов, дней"
        type="number"
        hint="Столько держится заявление преподавателя о взносе за занятие"
      )
    //- Взнос вносят помесячно либо разом за весь курс. Поле скидки стоит на месте
    //- всегда и лишь включается — форма не прыгает при переключении.
    .edu-course-form__pair
      .edu-course-form__switch
        BaseCheckbox(v-model="coursePayment" block)
          | Принимать взнос за весь курс разом
        .t-meta.t-muted {{ coursePaymentHint }}
      BaseInput(
        v-model="courseDiscount"
        label="Скидка за взнос разом, %"
        type="number"
        :disabled="!coursePayment"
        :hint="discountHint"
        :error="discountError"
      )

    //- Итог расчёта — отдельной плашкой во всю ширину под полями: он меняется
    //- на глазах и читается как результат, а не как ещё одно поле.
    .edu-course-form__total(v-if="fee")
      .edu-course-form__total-main
        div
          .t-sm.t-muted Взнос в месяц
          .edu-course-form__amount.t-num {{ formatAsset2Digits(fee.fee_month) }}
        div
          .t-sm.t-muted {{ courseFeeLabel }}
          .edu-course-form__amount.t-num(v-if="courseFeeShown") {{ formatAsset2Digits(fee.fee_course) }}
          .edu-course-form__amount.t-muted(v-else) ______
      .edu-course-form__total-rows
        .edu-course-form__total-row
          span.t-sm.t-muted Себестоимость в месяц
          span.t-sm.t-num {{ formatAsset2Digits(fee.cost_month) }}
        .edu-course-form__total-row
          span.t-sm.t-muted Наценка кооператива, {{ fee.markup_percent }}%
          span.t-sm.t-num {{ formatAsset2Digits(fee.markup_month) }}
        template(v-if="courseFeeShown")
          .edu-course-form__total-row
            span.t-sm.t-muted Помесячно за весь курс
            span.t-sm.t-num {{ formatAsset2Digits(fee.fee_course_base) }}
          .edu-course-form__total-row
            span.t-sm.t-muted Скидка за взнос разом
            span.t-sm.t-num {{ formatAsset2Digits(fee.course_discount_amount) }}
    .t-sm.t-muted(v-else) Заполните параметры занятий — взнос посчитается сам.

  section.edu-course-form__section
    .edu-course-form__legend Выдача доступа
    .edu-course-form__pair
      BaseSelect(v-model="form.direction" label="Тип направления" :options="directionOptions" hint="Внутренний признак, ученику не виден" required)
      BaseSelect(v-model="form.carrier" label="Носитель доступа" :options="carrierOptions" required)
    template(v-if="isSkillspace")
      BaseSelect(
        v-model="skillspaceCourseId"
        label="Курс в школе Skillspace"
        :options="platformCourseOptions"
        :disabled="!platformCourses.length"
        :hint="platformCourses.length ? 'Реестр курсов школы по API-ключу кооператива' : 'Реестр школы пуст или ключ Skillspace не задан'"
        searchable
        required
      )
      BaseSelect(
        v-model="skillspaceGroupId"
        label="Группа курса"
        :options="platformGroupOptions"
        :disabled="!platformGroupOptions.length"
        :hint="platformGroupOptions.length ? 'Без группы обучающийся зачисляется на курс напрямую' : 'У курса нет групп — зачисление на курс напрямую'"
        clearable
      )
    BaseInput(v-else-if="isPlatform" v-model="form.external_ref" label="Идентификатор курса на площадке" mono :hint="externalRefHint" required)

  //- Назначенные преподаватели идут списком имён, а выбор — строкой под ним.
  section.edu-course-form__section
    .edu-course-form__legend Преподаватели
    q-list.edu-course-form__teachers(v-if="form.teacher_usernames.length" separator)
      q-item(v-for="t in form.teacher_usernames" :key="t")
        q-item-section
          IdentityCell(:account-name="t" :full-name="teacherName(t)")
        q-item-section(side)
          BaseButton(variant="ghost" size="sm" icon-only type="button" :aria-label="`Убрать ${teacherName(t) || t}`" @click="removeTeacher(t)")
            template(#icon-left)
              q-icon(name="close" size="16px")
    .t-sm.t-muted(v-else) Курс можно сохранить и назначить преподавателей позже.
    BaseSelect(
      :model-value="null"
      label="Назначить преподавателя"
      :options="teacherOptions"
      :disabled="!teacherOptions.length"
      :hint="teacherHint"
      searchable
      @update:model-value="addTeacher"
    )

  template(v-if="!hideFooter" #footer)
    .row.justify-end.q-gutter-sm
      BaseButton(variant="ghost" type="button" :disabled="loading" @click="emit('cancel')") Отменить
      BaseButton(variant="primary" type="submit" :loading="loading") {{ course ? 'Сохранить' : 'Добавить курс' }}
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { fileToBase64, formatToAsset, pluralize } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCheckbox, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import { IdentityCell } from 'src/shared/ui/domain';
import { fetchCourseFeePreview, type ICourseFee } from '../../entities/Economy';
import {
  CARRIER_LABELS,
  CARRIERS_BY_DIRECTION,
  COURSE_IMAGE_ACCEPT,
  COURSE_IMAGE_MAX_BYTES,
  DIRECTION_LABELS,
  PLATFORM_CARRIERS,
  createCourse,
  fetchPlatformCourses,
  fetchTeacherOptions,
  updateCourse,
  type ICourse,
  type ICreateCourseInput,
  type IPlatformCourse,
  type ITeacherOption,
} from '../../entities/Course';

/**
 * Конструктор курса. Носитель доступа зависит от направления: онлайн-платформа —
 * Skillspace/GetCourse, закрытое сообщество — Telegram/ВКонтакте, очное — очно;
 * идентификатор курса на площадке нужен только площадкам с API. Преподаватели
 * выбираются из пайщиков с подписанным договором УХД, их может быть несколько.
 * Обложка уходит base64 внутри той же мутации, как изображения товара в
 * «Столе заказов»; без изменений поле не передаётся, снятая — `null`.
 */
const props = defineProps<{
  course?: ICourse | null;
  /** Кнопки живут снаружи — так форма ложится в правую панель с прибитым низом. */
  hideFooter?: boolean;
}>();
const emit = defineEmits<{ saved: [course: ICourse]; cancel: []; busy: [value: boolean] }>();

const system = useSystemStore();
const symbol = computed(() => system.governSymbol);

const loading = ref(false);
const error = ref('');
const teachers = ref<ITeacherOption[]>([]);

const form = reactive<ICreateCourseInput & { teacher_usernames: string[] }>({
  title: '',
  subject: '',
  grade: '',
  description: '',
  syllabus: '',
  schedule: '',
  teacher_usernames: [],
  lessons_per_month: 8,
  lessons_total: 64,
  lesson_minutes: 60,
  planned_hourly_rate: '',
  course_payment_enabled: false,
  course_discount_percent: 0,
  starts_at: null,
  guarantee_days: 14,
  direction: Zeus.EduCourseDirection.ONLINE_PLATFORM,
  carrier: Zeus.EduAccessCarrier.SKILLSPACE,
  external_ref: '',
  sort_order: 0,
});

// Обложка: новый файл (превью — object URL), снятие, либо без изменений.
const imageFile = ref<File | null>(null);
const imageRemoved = ref(false);
const objectUrl = ref<string | null>(null);
const previewUrl = computed(() => objectUrl.value ?? (imageRemoved.value ? null : (props.course?.image_url ?? null)));

function releaseObjectUrl(): void {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
  objectUrl.value = null;
}
const fileInput = ref<HTMLInputElement | null>(null);

function pickImage(): void {
  fileInput.value?.click();
}

function onFilePicked(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;
  if (file.size > COURSE_IMAGE_MAX_BYTES) {
    FailAlert(new Error(`Обложка больше ${Math.round(COURSE_IMAGE_MAX_BYTES / (1024 * 1024))} МБ — выберите файл поменьше`));
    return;
  }
  releaseObjectUrl();
  imageFile.value = file;
  imageRemoved.value = false;
  objectUrl.value = URL.createObjectURL(file);
}

function removeImage(): void {
  releaseObjectUrl();
  imageFile.value = null;
  imageRemoved.value = true;
}
async function imagePayload(): Promise<ICreateCourseInput['image']> {
  if (imageFile.value) return { base64: await fileToBase64(imageFile.value), mime_type: imageFile.value.type };
  if (imageRemoved.value) return null;
  return undefined;
}
onBeforeUnmount(releaseObjectUrl);

// Параметры занятий — числами в полях; ставка уходит asset-строкой «1000.0000 RUB».
const lessonsPerMonth = ref('8');
const lessonsTotal = ref('64');
const lessonMinutes = ref('60');
const plannedRate = ref('');
const guaranteeDays = ref('14');
const coursePayment = ref(false);
const courseDiscount = ref('0');

/** Расчёт взноса считает сервер: та же арифметика, что при сохранении курса. */
const fee = ref<ICourseFee | null>(null);
const discountError = computed(() =>
  coursePayment.value && fee.value && Number(courseDiscount.value || 0) > fee.value.max_course_discount_percent
    ? 'Скидка больше наценки — взнос за курс опустится ниже себестоимости'
    : '',
);
const discountHint = computed(() =>
  fee.value ? `Предельная скидка при наценке ${fee.value.markup_percent}% — ${fee.value.max_course_discount_percent}%` : 'Скидка тем, кто вносит взнос за весь курс сразу',
);
/** Длительность курса следует из программы: занятий в программе на занятий в месяц. */
const courseMonthsLabel = computed(() => {
  const n = fee.value?.course_months ?? 0;
  return n > 0 ? `${n} ${pluralize(n, ['месяц', 'месяца', 'месяцев'])}` : '';
});
const coursePaymentHint = computed(() =>
  courseMonthsLabel.value ? `Курс длится ${courseMonthsLabel.value} — по программе и нагрузке в месяц. Иначе взнос только помесячный.` : 'Иначе взнос только помесячный.',
);
const courseFeeShown = computed(() => coursePayment.value && (fee.value?.course_months ?? 0) > 0);
const courseFeeLabel = computed(() => (courseFeeShown.value ? `Взнос за весь курс · ${courseMonthsLabel.value}` : 'Взнос за весь курс'));

const economyParams = computed(() => ({
  lessons_per_month: Number(lessonsPerMonth.value || 0),
  lessons_total: Number(lessonsTotal.value || 0),
  lesson_minutes: Number(lessonMinutes.value || 0),
  planned_hourly_rate: toAsset(plannedRate.value || '0'),
  course_payment_enabled: coursePayment.value,
  course_discount_percent: coursePayment.value ? Number(courseDiscount.value || 0) : 0,
}));

let previewTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  economyParams,
  (params) => {
    if (previewTimer) clearTimeout(previewTimer);
    // Пока параметры неполные, считать нечего: сервер такой набор отклонит.
    if (params.lessons_per_month < 1 || params.lessons_total < 1 || params.lesson_minutes < 5) {
      fee.value = null;
      return;
    }
    previewTimer = setTimeout(async () => {
      try {
        fee.value = await fetchCourseFeePreview(params);
      } catch {
        // Расчёт — подсказка: отказ сервера здесь не мешает заполнять форму дальше.
        fee.value = null;
      }
    }, 400);
  },
  { immediate: true, deep: true },
);
onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer);
});

// Skillspace: привязка выбирается из реестра школы, а не вводится руками —
// числовой номер из адреса конструктора площадка не знает, а UUID в адресе
// обычно принадлежит модулю. Хранится «UUID курса» или «UUID курса:UUID группы».
const platformCourses = ref<IPlatformCourse[]>([]);
const skillspaceCourseId = ref<string | null>(null);
const skillspaceGroupId = ref<string | null>(null);

function toAsset(value: string): string {
  return formatToAsset(String(value).replace(',', '.'), symbol.value);
}
function fromAsset(value?: string | null): string {
  return value ? String(parseFloat(value)) : '';
}

watch(
  () => props.course,
  (c) => {
    if (!c) return;
    Object.assign(form, {
      title: c.title,
      subject: c.subject,
      grade: c.grade,
      description: c.description,
      syllabus: c.syllabus,
      schedule: c.schedule,
      teacher_usernames: [...c.teacher_usernames],
      direction: c.direction,
      carrier: c.carrier,
      starts_at: c.starts_at,
      external_ref: c.external_ref,
      sort_order: c.sort_order,
    });
    lessonsPerMonth.value = String(c.lessons_per_month);
    lessonsTotal.value = String(c.lessons_total);
    lessonMinutes.value = String(c.lesson_minutes);
    plannedRate.value = fromAsset(c.planned_hourly_rate);
    guaranteeDays.value = String(c.guarantee_days);
    coursePayment.value = c.course_payment_enabled;
    courseDiscount.value = String(c.course_discount_percent);
    releaseObjectUrl();
    imageFile.value = null;
    imageRemoved.value = false;
    if (c.carrier === Zeus.EduAccessCarrier.SKILLSPACE) {
      const [course = '', group = ''] = c.external_ref.split(':');
      skillspaceCourseId.value = course || null;
      skillspaceGroupId.value = group || null;
    }
  },
  { immediate: true },
);

const directionOptions = Object.entries(DIRECTION_LABELS).map(([value, label]) => ({ value, label }));
const allowedCarriers = computed(() => CARRIERS_BY_DIRECTION[form.direction] ?? []);
const carrierOptions = computed(() => allowedCarriers.value.map((value) => ({ value, label: CARRIER_LABELS[value] ?? value })));
const isPlatform = computed(() => PLATFORM_CARRIERS.includes(form.carrier));
const isSkillspace = computed(() => form.carrier === Zeus.EduAccessCarrier.SKILLSPACE);
const externalRefHint = 'Идентификатор группы GetCourse, в которую попадает обучающийся';

const platformCourseOptions = computed(() => platformCourses.value.map((c) => ({ value: c.id, label: c.name })));
const platformGroupOptions = computed(
  () => platformCourses.value.find((c) => c.id === skillspaceCourseId.value)?.groups.map((g) => ({ value: g.id, label: g.name })) ?? [],
);
watch(skillspaceCourseId, () => {
  if (!platformGroupOptions.value.some((g) => g.value === skillspaceGroupId.value)) skillspaceGroupId.value = null;
});
watch([skillspaceCourseId, skillspaceGroupId], ([course, group]) => {
  if (isSkillspace.value) form.external_ref = course ? (group ? `${course}:${group}` : course) : '';
});
watch(
  isSkillspace,
  async (on) => {
    if (!on || platformCourses.value.length) return;
    try {
      platformCourses.value = await fetchPlatformCourses(Zeus.EduAccessCarrier.SKILLSPACE);
    } catch (e) {
      FailAlert(e);
    }
  },
  { immediate: true },
);

// Сменили направление — носитель вне его списка теряет смысл: берём первый допустимый.
watch(
  () => form.direction,
  () => {
    if (!allowedCarriers.value.includes(form.carrier)) form.carrier = allowedCarriers.value[0]!;
  },
);
watch(isPlatform, (platform) => {
  if (!platform) form.external_ref = '';
});

// В списке — имя человека и номер его договора: учётное имя администратору
// ничего не говорит, а договор отличает однофамильцев.
const teacherOptions = computed(() =>
  teachers.value
    .filter((t) => !form.teacher_usernames.includes(t.username))
    .map((t) => ({ value: t.username, label: `${t.display_name || t.username} · договор № ${t.contract_number}` })),
);
const teacherName = (username: string) => teachers.value.find((t) => t.username === username)?.display_name || null;
const teacherHint = computed(() =>
  teachers.value.length
    ? 'Пайщики с подписанным договором участия в хозяйственной деятельности'
    : 'Пока никто не подписал договор участия в хозяйственной деятельности',
);

function addTeacher(value: string | number | null): void {
  const username = String(value ?? '');
  if (!username || form.teacher_usernames.includes(username)) return;
  form.teacher_usernames.push(username);
}
function removeTeacher(username: string): void {
  form.teacher_usernames = form.teacher_usernames.filter((t) => t !== username);
}

async function submit(): Promise<void> {
  error.value = '';
  loading.value = true;
  emit('busy', true);
  try {
    const data: ICreateCourseInput = {
      ...form,
      image: await imagePayload(),
      external_ref: isPlatform.value ? form.external_ref : '',
      guarantee_days: Number(guaranteeDays.value || 0),
      ...economyParams.value,
    };
    const saved = props.course ? await updateCourse({ ...data, id: props.course.id }) : await createCourse(data);
    SuccessAlert(props.course ? 'Курс сохранён' : 'Курс добавлен');
    emit('saved', saved);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
    emit('busy', false);
  }
}

// Правая панель держит кнопки у нижнего края и сама зовёт отправку формы —
// поля при этом проверяются так же, как при отправке изнутри.
const formEl = ref<InstanceType<typeof BaseForm> | null>(null);

async function requestSubmit(): Promise<void> {
  if (!(await formEl.value?.validate())) return;
  await submit();
}

defineExpose({ submit: requestSubmit });

onMounted(async () => {
  try {
    teachers.value = await fetchTeacherOptions();
  } catch (e) {
    FailAlert(e);
  }
});
</script>

<style scoped>
.edu-course-form {
  display: flex;
  flex-direction: column;
}
/* Раздел формы: поля в одну колонку, между разделами — воздух и линия. */
.edu-course-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-5) 0;
  border-top: 1px solid var(--p-line);
}
.edu-course-form__section:first-of-type {
  padding-top: 0;
  border-top: none;
}
.edu-course-form__legend {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
/* Пара коротких полей встаёт в ряд, только когда хватает ширины: иначе
   подсказка под одним полем обрезается высотой соседнего. */
/* Переключатель стоит в паре с полем скидки: выровнен по его середине. */
.edu-course-form__switch {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding-top: var(--p-2);
}
.edu-course-form__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--p-3);
  align-items: start;
}
.edu-course-form__cover {
  position: relative;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  overflow: hidden;
  background: var(--p-surface-2);
}
/* Действия всплывают поверх снимка и не занимают места, пока не нужны. */
.edu-course-form__cover-actions {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
  padding: var(--p-2);
  background: linear-gradient(to top, rgba(15, 23, 24, 0.72), transparent);
  opacity: 0;
  transition: opacity 0.16s ease;
}
.edu-course-form__cover:hover .edu-course-form__cover-actions,
.edu-course-form__cover:focus-within .edu-course-form__cover-actions {
  opacity: 1;
}
.edu-course-form__picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--p-1);
  padding: var(--p-5) var(--p-4);
  border: 1px dashed var(--p-line-2, var(--p-line));
  border-radius: var(--p-r-md);
  color: var(--p-ink-2);
  cursor: pointer;
  transition: border-color 0.16s ease, color 0.16s ease;
}
.edu-course-form__picker:hover,
.edu-course-form__picker:focus-visible {
  border-color: var(--p-primary-line);
  color: var(--p-primary);
  outline: none;
}
.edu-course-form__file {
  display: none;
}
/* Итог расчёта: две главные суммы крупно, слагаемые — строками под ними. */
.edu-course-form__total {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  padding: var(--p-4);
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.edu-course-form__total-main {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--p-3);
}
.edu-course-form__amount {
  font-size: var(--p-fs-h4, 18px);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--p-ink);
  margin-top: 2px;
}
.edu-course-form__total-rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding-top: var(--p-3);
  border-top: 1px solid var(--p-line);
}
.edu-course-form__total-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3);
}
.edu-course-form__teachers {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}
</style>
