<template lang="pug">
q-page.edu-course-edit
  .edu-course-edit__col
    CardListSkeleton(v-if="isEdit && firstLoad" :count="1")

    EmptyState(v-else-if="isEdit && !course" title="Курс не найден" body="Возможно, курс удалён из реестра.")
      template(#icon)
        q-icon(name="search_off" size="40px")

    //- Курс заполняется по разделам сверху вниз, как заявка на поставку: у
    //- каждого шага свой смысл, поля не теснятся. Состояние формы живёт у
    //- страницы, поэтому переход между шагами введённое не теряет.
    template(v-else)
      VerticalStepper(
        :steps="steps"
        :active-key="activeKey"
        :completed="completedKeys"
        @change="goTo"
      )
        template(#active="{ step }")
          .edu-course-edit__step
            CourseForm(ref="formRef" :section="sectionOf(step.key)" hide-footer @saved="onSaved" @busy="(v) => (saving = v)")

      footer.edu-course-edit__foot
        BaseButton(v-if="index === 0" variant="ghost" :disabled="saving" @click="leave") Отменить
        BaseButton(v-else variant="ghost" :disabled="saving" @click="goTo(steps[index - 1].key)")
          template(#icon-left)
            q-icon(name="arrow_back" size="16px")
          | Назад
        q-space
        BaseButton(v-if="!isLast" :variant="isEdit ? 'secondary' : 'primary'" :disabled="saving" @click="next")
          | Далее
          template(#icon-right)
            q-icon(name="arrow_forward" size="16px")
        BaseButton(v-if="isEdit || isLast" variant="primary" :loading="saving" @click="save") {{ isEdit ? 'Сохранить' : 'Добавить курс' }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { VerticalStepper, type StepperStep } from 'src/shared/ui/domain';
import { fetchCourse, type ICourse } from '../../entities/Course';
import { CourseForm, provideCourseForm, type CourseFormSection } from '../../widgets/CourseForm';

/**
 * Полная страница курса: новый курс и правка существующего. Разделы идут шагами;
 * при правке все шаги открыты сразу и сохранить можно с любого, при создании —
 * по порядку, «Добавить курс» на последнем шаге.
 */
const route = useRoute();
const router = useRouter();

const courseId = computed(() => (route.params.id ? String(route.params.id) : ''));
const isEdit = computed(() => Boolean(courseId.value));

const course = ref<ICourse | null>(null);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const saving = ref(false);
const formRef = ref<InstanceType<typeof CourseForm> | null>(null);

provideCourseForm(() => course.value);

const steps: Array<StepperStep & { key: CourseFormSection }> = [
  { key: 'course', label: 'Курс', description: 'Название, предмет, расписание, описание и программа' },
  { key: 'cover', label: 'Обложка', description: 'Снимок для каталога', optional: true },
  { key: 'price', label: 'Стоимость и сроки', description: 'Занятия, ставка, гарантийный срок и взнос' },
  { key: 'access', label: 'Выдача доступа', description: 'Где ученик проходит курс' },
  { key: 'teachers', label: 'Преподаватели', description: 'Кто ведёт курс', optional: true },
];

const activeKey = ref<CourseFormSection>('course');
const visited = ref<CourseFormSection[]>([]);
const index = computed(() => steps.findIndex((s) => s.key === activeKey.value));
const isLast = computed(() => index.value === steps.length - 1);
// При правке курс уже заполнен — любой шаг открыт; при создании — пройденные.
const completedKeys = computed(() =>
  isEdit.value ? steps.map((s) => s.key).filter((k) => k !== activeKey.value) : visited.value,
);

/** Ключ шага из списка — он же раздел формы. */
function sectionOf(key: string): CourseFormSection {
  return steps.find((s) => s.key === key)?.key ?? 'course';
}

function goTo(key: string): void {
  activeKey.value = sectionOf(key);
}

async function next(): Promise<void> {
  if (!(await formRef.value?.validate())) return;
  if (!visited.value.includes(activeKey.value)) visited.value.push(activeKey.value);
  goTo(steps[index.value + 1]!.key);
}

async function save(): Promise<void> {
  await formRef.value?.submit();
}

function leave(): void {
  if (isEdit.value) void router.push({ name: 'edubridge-admin-course', params: { coopname: route.params.coopname, id: courseId.value } });
  else void router.push({ name: 'edubridge-admin-courses', params: { coopname: route.params.coopname } });
}

function onSaved(saved: ICourse): void {
  void router.push({ name: 'edubridge-admin-course', params: { coopname: route.params.coopname, id: asText(saved.id) } });
}

onMounted(async () => {
  if (!isEdit.value) return;
  loading.value = true;
  try {
    course.value = await fetchCourse(courseId.value);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.edu-course-edit {
  padding: var(--p-6) var(--p-4);
}
.edu-course-edit__col {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.edu-course-edit__step {
  padding: var(--p-2) 0 var(--p-4);
}
/* Навигация прибита к низу экрана: «Назад» и «Сохранить» всегда на виду.
   margin-bottom гасит нижний отступ страницы — бар не прыгает в конце прокрутки. */
.edu-course-edit__foot {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-bottom: calc(-1 * var(--p-6));
  padding: var(--p-3) 0;
  background: var(--p-canvas);
  border-top: 1px solid var(--p-line);
}
</style>
