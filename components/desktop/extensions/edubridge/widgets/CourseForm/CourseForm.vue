<template lang="pug">
BaseForm(:loading="loading" :error="error" @submit="submit")
  .row.q-col-gutter-md
    .col-12
      BaseInput(v-model="form.title" label="Название курса" required)
    .col-12.col-md-6
      BaseInput(v-model="form.subject" label="Предмет" required)
    .col-12.col-md-6
      BaseInput(v-model="form.grade" label="Класс" placeholder="7 класс" required)
    .col-12
      BaseInput(v-model="form.schedule" label="Расписание" placeholder="Вт, Чт 17:00–18:30")
    .col-12
      BaseInput(v-model="form.description" label="Описание" type="textarea" :rows="3" autogrow)
    .col-12
      BaseInput(v-model="form.syllabus" label="Учебная программа" type="textarea" :rows="5" autogrow)
    .col-12
      .t-sm.t-muted.q-mb-xs Обложка курса
      .row.q-col-gutter-md.items-start
        .col-12.col-md-5
          .edu-course-form__preview
            q-img(v-if="previewUrl" :src="previewUrl" :ratio="16 / 9" fit="cover" no-spinner)
            .edu-course-form__placeholder(v-else)
              q-icon(name="image" size="32px")
              .t-sm.q-mt-xs Без обложки
          BaseButton.q-mt-sm(v-if="previewUrl" variant="ghost" size="sm" type="button" @click="removeImage") Убрать обложку
        .col-12.col-md-7
          FileUploader(
            :model-value="imageFile"
            :accept="COURSE_IMAGE_ACCEPT"
            :max-size="COURSE_IMAGE_MAX_BYTES"
            title="Загрузить обложку"
            hint="JPEG, PNG или WEBP до 10 МБ. Показывается в каталоге и на странице курса."
            @update:model-value="onImagePicked"
            @error="onImageError"
          )
    .col-12.col-md-6
      BaseInput(v-model="feeMonth" label="Членский взнос в месяц" type="number" :suffix="symbol" required)
    .col-12.col-md-6
      BaseInput(v-model="feeYear" label="Членский взнос в год" type="number" :suffix="symbol" required)
    .col-12.col-md-6
      BaseSelect(v-model="form.direction" label="Тип направления (внутренний)" :options="directionOptions" required)
    .col-12.col-md-6
      BaseSelect(v-model="form.carrier" label="Носитель доступа" :options="carrierOptions" required)
    template(v-if="isSkillspace")
      .col-12.col-md-6
        BaseSelect(
          v-model="skillspaceCourseId"
          label="Курс в школе Skillspace"
          :options="platformCourseOptions"
          :disabled="!platformCourses.length"
          :hint="platformCourses.length ? 'Реестр курсов школы по API-ключу кооператива' : 'Реестр школы пуст или ключ Skillspace не задан'"
          searchable
          required
        )
      .col-12.col-md-6
        BaseSelect(
          v-model="skillspaceGroupId"
          label="Группа курса"
          :options="platformGroupOptions"
          :disabled="!platformGroupOptions.length"
          :hint="platformGroupOptions.length ? 'Без группы обучающийся зачисляется на курс напрямую' : 'У курса нет групп — зачисление на курс напрямую'"
          clearable
        )
    .col-12(v-else-if="isPlatform")
      BaseInput(v-model="form.external_ref" label="Идентификатор курса на площадке" mono :hint="externalRefHint" required)

    .col-12
      .t-sm.t-muted.q-mb-xs {{ teacherLabel }}
      .row.q-col-gutter-sm.items-start
        .col-12.col-md-6
          BaseSelect(
            :model-value="null"
            label="Добавить преподавателя"
            :options="teacherOptions"
            :disabled="!teacherOptions.length"
            :hint="teacherHint"
            searchable
            @update:model-value="addTeacher"
          )
        .col-12.col-md-6
          .row.q-gutter-xs(v-if="form.teacher_usernames.length")
            .col-auto(v-for="t in form.teacher_usernames" :key="t")
              BaseChip(variant="neutral" size="sm")
                span.t-mono {{ t }}
                BaseButton.q-ml-xs(variant="ghost" size="sm" icon-only type="button" :aria-label="`Убрать ${t}`" @click="removeTeacher(t)")
                  template(#icon-left)
                    q-icon(name="close" size="14px")
          .t-sm.t-muted(v-else) Преподаватели пока не назначены — курс можно сохранить и назначить их позже.
  template(#footer)
    .row.justify-end.q-gutter-sm
      BaseButton(variant="ghost" type="button" :disabled="loading" @click="emit('cancel')") Отменить
      BaseButton(variant="primary" type="submit" :loading="loading") {{ course ? 'Сохранить' : 'Добавить курс' }}
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { fileToBase64, formatToAsset } from 'src/shared/lib/utils';
import { BaseButton, BaseChip, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import { FileUploader, type FileUploaderError } from 'src/shared/ui/domain';
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
const props = defineProps<{ course?: ICourse | null }>();
const emit = defineEmits<{ saved: [course: ICourse]; cancel: [] }>();

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
  fee_month: '',
  fee_year: '',
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
function onImagePicked(value: File | File[] | null): void {
  const file = Array.isArray(value) ? (value[0] ?? null) : value;
  releaseObjectUrl();
  imageFile.value = file;
  imageRemoved.value = false;
  if (file) objectUrl.value = URL.createObjectURL(file);
}
function onImageError(e: FileUploaderError): void {
  FailAlert(new Error(e.message));
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

// Суммы в поле — числом, в цепь уходят asset-строкой «1000.0000 RUB».
const feeMonth = ref('');
const feeYear = ref('');

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
      external_ref: c.external_ref,
      sort_order: c.sort_order,
    });
    feeMonth.value = fromAsset(c.fee_month);
    feeYear.value = fromAsset(c.fee_year);
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

const teacherOptions = computed(() =>
  teachers.value
    .filter((t) => !form.teacher_usernames.includes(t.username))
    .map((t) => ({ value: t.username, label: `${t.username} · договор № ${t.contract_number}` })),
);
const teacherLabel = computed(() => (form.teacher_usernames.length > 1 ? 'Преподаватели' : 'Преподаватель'));
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
  try {
    const data: ICreateCourseInput = {
      ...form,
      image: await imagePayload(),
      external_ref: isPlatform.value ? form.external_ref : '',
      fee_month: toAsset(feeMonth.value),
      fee_year: toAsset(feeYear.value),
    };
    const saved = props.course ? await updateCourse({ ...data, id: props.course.id }) : await createCourse(data);
    SuccessAlert(props.course ? 'Курс сохранён' : 'Курс добавлен');
    emit('saved', saved);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    teachers.value = await fetchTeacherOptions();
  } catch (e) {
    FailAlert(e);
  }
});
</script>

<style scoped>
.edu-course-form__preview {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  overflow: hidden;
  background: var(--p-surface-2);
}
.edu-course-form__placeholder {
  aspect-ratio: 16 / 9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
}
</style>
