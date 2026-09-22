<template lang="pug">
BaseForm.edu-course-form(ref="formEl" :loading="loading" :error="error" @submit="submit")
  //- Форма идёт разделами сверху вниз, поля — в одну колонку с подсказкой под
  //- каждым: так читается, что от чего зависит. Пары коротких полей встают
  //- рядом только когда места хватает, поэтому подсказки не обрезаются.
  section.edu-course-form__section(v-if="show('course')")
    .edu-course-form__legend(v-if="!section") Курс
    BaseInput(v-model="form.title" label="Название курса" hint="Как курс увидят в каталоге" required)
    .edu-course-form__pair
      BaseInput(v-model="form.subject" label="Предмет" required)
      BaseInput(v-model="form.grade" label="Класс" placeholder="7 класс" required)
    BaseInput(v-model="form.schedule" label="Расписание" placeholder="Вт, Чт 17:00–18:30" hint="Дни и время занятий — строкой, как их видит ученик")
    BaseInput(v-model="form.description" label="Описание" type="textarea" :rows="3" autogrow)
    BaseInput(v-model="form.syllabus" label="Учебная программа" type="textarea" :rows="5" autogrow)

  section.edu-course-form__section(v-if="show('cover')")
    .edu-course-form__legend(v-if="!section") Обложка
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
  section.edu-course-form__section(v-if="show('price')")
    .edu-course-form__legend(v-if="!section") Стоимость
    .edu-course-form__group
      .edu-course-form__group-title Занятия
      .edu-course-form__pair
        BaseInput(v-model="lessonsPerMonth" label="Занятий в месяц" type="number" hint="По расписанию курса" required)
        BaseInput(v-model="lessonMinutes" label="Длительность занятия, минут" type="number" required)
      BaseInput(v-model="lessonsTotal" label="Занятий в программе" type="number" hint="Всего занятий курса — от них считается его длительность" required)

    .edu-course-form__group
      .edu-course-form__group-title Ставка
      BaseInput(v-model="plannedRate" label="Ставка часа" type="number" :suffix="symbol" hint="Плановая ставка преподавателя: из неё складывается взнос" required)

    .edu-course-form__group
      .edu-course-form__group-title Сроки
      .edu-course-form__pair
        BaseInput(
          v-model="form.starts_at"
          label="Дата начала занятий"
          type="date"
          stack-label
          hint="От неё отсчитывается гарантийный срок курса"
        )
        BaseInput(
          v-model="guaranteeDays"
          label="Гарантийный срок, дней"
          type="number"
          hint="Столько дней ученик может вернуть взнос"
        )

    //- Взнос вносят помесячно либо разом за весь курс. Поле скидки стоит на месте
    //- всегда и лишь включается — форма не прыгает при переключении.
    .edu-course-form__group
      .edu-course-form__group-title Взнос за весь курс
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

  section.edu-course-form__section(v-if="show('access')")
    .edu-course-form__legend(v-if="!section") Выдача доступа
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
  section.edu-course-form__section(v-if="show('teachers')")
    .edu-course-form__legend(v-if="!section") Преподаватели
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
import { ref } from 'vue';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCheckbox, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import { IdentityCell } from 'src/shared/ui/domain';
import { COURSE_IMAGE_ACCEPT, type ICourse } from '../../entities/Course';
import { createCourseFormState, injectCourseForm, type CourseFormSection } from './model/useCourseForm';

/**
 * Конструктор курса. На полной странице правки каждый раздел — отдельный шаг,
 * а состояние живёт у страницы; сама по себе форма показывает все разделы и
 * держит состояние у себя.
 */
const props = defineProps<{
  course?: ICourse | null;
  /** Кнопки живут снаружи — на странице правки их держит нижняя панель. */
  hideFooter?: boolean;
  /** Показать один раздел; без него — все. */
  section?: CourseFormSection;
}>();
const emit = defineEmits<{ saved: [course: ICourse]; cancel: []; busy: [value: boolean] }>();

const state = injectCourseForm() ?? createCourseFormState(() => props.course);
const {
  symbol,
  loading,
  error,
  form,
  previewUrl,
  fileInput,
  pickImage,
  onFilePicked,
  removeImage,
  lessonsPerMonth,
  lessonsTotal,
  lessonMinutes,
  plannedRate,
  guaranteeDays,
  coursePayment,
  courseDiscount,
  fee,
  discountError,
  discountHint,
  coursePaymentHint,
  courseFeeShown,
  courseFeeLabel,
  platformCourses,
  skillspaceCourseId,
  skillspaceGroupId,
  directionOptions,
  carrierOptions,
  isPlatform,
  isSkillspace,
  externalRefHint,
  platformCourseOptions,
  platformGroupOptions,
  teacherOptions,
  teacherName,
  teacherHint,
  addTeacher,
  removeTeacher,
} = state;

const show = (section: CourseFormSection): boolean => !props.section || props.section === section;

async function submit(): Promise<void> {
  emit('busy', true);
  const saved = await state.submit();
  emit('busy', false);
  if (saved) emit('saved', saved);
}

// Снаружи формы кнопки зовут проверку и отправку сами — поля при этом
// проверяются так же, как при отправке изнутри.
const formEl = ref<InstanceType<typeof BaseForm> | null>(null);

async function validate(): Promise<boolean> {
  return Boolean(await formEl.value?.validate());
}

async function requestSubmit(): Promise<void> {
  if (!(await validate())) return;
  await submit();
}

defineExpose({ submit: requestSubmit, validate });
</script>

<style scoped>
.edu-course-form {
  display: flex;
  flex-direction: column;
}
/* Раздел формы: между разделами — воздух и линия. */
.edu-course-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-6);
  padding: var(--p-6) 0;
  border-top: 1px solid var(--p-line);
}
.edu-course-form__section:first-of-type {
  padding-top: 0;
  border-top: none;
}
.edu-course-form__legend {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}
/* Группа полей внутри раздела: короткий подзаголовок и поля под ним. */
.edu-course-form__group {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.edu-course-form__group-title {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  font-weight: 600;
  color: var(--p-ink-2);
}
.edu-course-form__switch {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
/* Пара коротких полей встаёт в ряд, только когда хватает ширины: иначе
   подсказка под одним полем обрезается высотой соседнего. */
.edu-course-form__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--p-3) var(--p-4);
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
  padding: var(--p-5);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
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
  gap: var(--p-2);
  padding-top: var(--p-4);
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
