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
    .col-12.col-md-6
      BaseInput(v-model="feeMonth" label="Членский взнос в месяц" type="number" :suffix="symbol" required)
    .col-12.col-md-6
      BaseInput(v-model="feeYear" label="Членский взнос в год" type="number" :suffix="symbol" required)
    .col-12.col-md-6
      BaseSelect(v-model="form.direction" label="Тип направления (внутренний)" :options="directionOptions" required)
    .col-12.col-md-6
      BaseSelect(v-model="form.carrier" label="Носитель доступа" :options="carrierOptions" required)
    .col-12.col-md-8
      BaseInput(v-model="form.external_ref" label="Идентификатор курса на площадке" mono hint="Код или идентификатор курса в Skillspace/GetCourse; для очного — код группы")
    .col-12.col-md-4
      BaseInput(v-model="form.teacher_username" label="Преподаватель" mono hint="Учётное имя пайщика")
  template(#footer)
    .row.justify-end.q-gutter-sm
      BaseButton(variant="ghost" type="button" :disabled="loading" @click="emit('cancel')") Отменить
      BaseButton(variant="primary" type="submit" :loading="loading") {{ course ? 'Сохранить' : 'Добавить курс' }}
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { formatToAsset } from 'src/shared/lib/utils';
import { BaseButton, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import {
  CARRIER_LABELS,
  DIRECTION_LABELS,
  createCourse,
  updateCourse,
  type ICourse,
  type ICreateCourseInput,
} from '../../entities/Course';

const props = defineProps<{ course?: ICourse | null }>();
const emit = defineEmits<{ saved: [course: ICourse]; cancel: [] }>();

const system = useSystemStore();
const symbol = computed(() => system.governSymbol);

const loading = ref(false);
const error = ref('');

const form = reactive<ICreateCourseInput>({
  title: '',
  subject: '',
  grade: '',
  description: '',
  syllabus: '',
  schedule: '',
  teacher_username: '',
  fee_month: '',
  fee_year: '',
  direction: 'online_platform' as ICreateCourseInput['direction'],
  carrier: 'skillspace' as ICreateCourseInput['carrier'],
  external_ref: '',
  sort_order: 0,
});

// Суммы в поле — числом, в цепь уходят asset-строкой «1000.0000 RUB».
const feeMonth = ref('');
const feeYear = ref('');

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
      teacher_username: c.teacher_username ?? '',
      direction: c.direction,
      carrier: c.carrier,
      external_ref: c.external_ref,
      sort_order: c.sort_order,
    });
    feeMonth.value = fromAsset(c.fee_month);
    feeYear.value = fromAsset(c.fee_year);
  },
  { immediate: true },
);

const directionOptions = Object.entries(DIRECTION_LABELS).map(([value, label]) => ({ value, label }));
const carrierOptions = Object.entries(CARRIER_LABELS).map(([value, label]) => ({ value, label }));

async function submit(): Promise<void> {
  error.value = '';
  loading.value = true;
  try {
    const data: ICreateCourseInput = {
      ...form,
      teacher_username: form.teacher_username || null,
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
</script>
