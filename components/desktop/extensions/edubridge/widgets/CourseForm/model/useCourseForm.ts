import { computed, inject, onBeforeUnmount, onMounted, provide, reactive, ref, watch, type ComputedRef, type InjectionKey } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { fileToBase64, formatToAsset, pluralize } from 'src/shared/lib/utils';
import { fetchCourseFeePreview, type ICourseFee } from '../../../entities/Economy';
import {
  CARRIER_LABELS,
  CARRIERS_BY_DIRECTION,
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
} from '../../../entities/Course';

/** Разделы формы курса: на полной странице каждый — отдельный шаг. */
export type CourseFormSection = 'course' | 'cover' | 'price' | 'access' | 'teachers';

type CourseSource = () => ICourse | null | undefined;
type CourseFormFields = ICreateCourseInput & { teacher_usernames: string[] };

function emptyForm(): CourseFormFields {
  return reactive<CourseFormFields>({
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
}

/** Обложка: новый файл (превью — object URL), снятие, либо без изменений. */
function useCover(course: CourseSource) {
  const imageFile = ref<File | null>(null);
  const imageRemoved = ref(false);
  const objectUrl = ref<string | null>(null);
  const fileInput = ref<HTMLInputElement | null>(null);
  const previewUrl = computed(() => objectUrl.value ?? (imageRemoved.value ? null : (course()?.image_url ?? null)));

  function releaseObjectUrl(): void {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
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
  function resetImage(): void {
    releaseObjectUrl();
    imageFile.value = null;
    imageRemoved.value = false;
  }
  async function imagePayload(): Promise<ICreateCourseInput['image']> {
    if (imageFile.value) return { base64: await fileToBase64(imageFile.value), mime_type: imageFile.value.type };
    if (imageRemoved.value) return null;
    return undefined;
  }
  onBeforeUnmount(releaseObjectUrl);

  return { previewUrl, fileInput, pickImage, onFilePicked, removeImage, resetImage, imagePayload };
}

/** Параметры занятий — числами в полях; ставка уходит asset-строкой «1000.0000 RUB». */
function useEconomyFields(symbol: ComputedRef<string>) {
  const lessonsPerMonth = ref('8');
  const lessonsTotal = ref('64');
  const lessonMinutes = ref('60');
  const plannedRate = ref('');
  const guaranteeDays = ref('14');
  const coursePayment = ref(false);
  const courseDiscount = ref('0');

  const economyParams = computed(() => ({
    lessons_per_month: Number(lessonsPerMonth.value || 0),
    lessons_total: Number(lessonsTotal.value || 0),
    lesson_minutes: Number(lessonMinutes.value || 0),
    planned_hourly_rate: formatToAsset(String(plannedRate.value || '0').replace(',', '.'), symbol.value),
    course_payment_enabled: coursePayment.value,
    course_discount_percent: coursePayment.value ? Number(courseDiscount.value || 0) : 0,
  }));

  function fillEconomy(c: ICourse): void {
    lessonsPerMonth.value = String(c.lessons_per_month);
    lessonsTotal.value = String(c.lessons_total);
    lessonMinutes.value = String(c.lesson_minutes);
    plannedRate.value = c.planned_hourly_rate ? String(parseFloat(c.planned_hourly_rate)) : '';
    guaranteeDays.value = String(c.guarantee_days);
    coursePayment.value = c.course_payment_enabled;
    courseDiscount.value = String(c.course_discount_percent);
  }

  return { lessonsPerMonth, lessonsTotal, lessonMinutes, plannedRate, guaranteeDays, coursePayment, courseDiscount, economyParams, fillEconomy };
}

/** Расчёт взноса считает сервер: та же арифметика, что при сохранении курса. */
function useFeePreview(economy: ReturnType<typeof useEconomyFields>) {
  const { economyParams, coursePayment, courseDiscount } = economy;
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
  const courseFeeLabel = computed(() => (courseFeeShown.value ? `Взнос за весь курс, ${courseMonthsLabel.value}` : 'Взнос за весь курс'));

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

  return { fee, discountError, discountHint, coursePaymentHint, courseFeeShown, courseFeeLabel };
}

const directionOptions = Object.entries(DIRECTION_LABELS).map(([value, label]) => ({ value, label }));
const externalRefHint = 'Идентификатор группы GetCourse, в которую попадает обучающийся';

/**
 * Выдача доступа. Носитель зависит от направления: онлайн-платформа —
 * Skillspace/GetCourse, закрытое сообщество — Telegram/ВКонтакте, очное — очно.
 * Skillspace: привязка выбирается из реестра школы, хранится «UUID курса» или
 * «UUID курса:UUID группы».
 */
function useAccess(form: CourseFormFields) {
  const platformCourses = ref<IPlatformCourse[]>([]);
  const skillspaceCourseId = ref<string | null>(null);
  const skillspaceGroupId = ref<string | null>(null);
  const allowedCarriers = computed(() => CARRIERS_BY_DIRECTION[form.direction] ?? []);
  const carrierOptions = computed(() => allowedCarriers.value.map((value) => ({ value, label: CARRIER_LABELS[value] ?? value })));
  const isPlatform = computed(() => PLATFORM_CARRIERS.includes(form.carrier));
  const isSkillspace = computed(() => form.carrier === Zeus.EduAccessCarrier.SKILLSPACE);
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

  function fillAccess(c: ICourse): void {
    if (c.carrier !== Zeus.EduAccessCarrier.SKILLSPACE) return;
    const [course = '', group = ''] = c.external_ref.split(':');
    skillspaceCourseId.value = course || null;
    skillspaceGroupId.value = group || null;
  }

  return {
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
    fillAccess,
  };
}

/** Преподаватели — пайщики с подписанным договором УХД, их может быть несколько. */
function useTeachers(form: CourseFormFields) {
  const teachers = ref<ITeacherOption[]>([]);
  // В списке — имя человека и номер его договора: учётное имя администратору
  // ничего не говорит, а договор отличает однофамильцев.
  const teacherOptions = computed(() =>
    teachers.value
      .filter((t) => !form.teacher_usernames.includes(t.username))
      .map((t) => ({ value: t.username, label: `${t.display_name || t.username}, договор № ${t.contract_number}` })),
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

  onMounted(async () => {
    try {
      teachers.value = await fetchTeacherOptions();
    } catch (e) {
      FailAlert(e);
    }
  });

  return { teacherOptions, teacherName, teacherHint, addTeacher, removeTeacher };
}

function fillForm(form: CourseFormFields, c: ICourse): void {
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
}

/**
 * Состояние конструктора курса. Живёт отдельно от разметки: страница правки
 * показывает разделы по шагам, и раздел монтируется заново при каждом переходе —
 * введённое не теряется, потому что хранится здесь, а не в разделе.
 */
export function createCourseFormState(course: CourseSource) {
  const system = useSystemStore();
  const symbol = computed(() => system.governSymbol);
  const loading = ref(false);
  const error = ref('');
  const form = emptyForm();
  const cover = useCover(course);
  const economy = useEconomyFields(symbol);
  const feePreview = useFeePreview(economy);
  const access = useAccess(form);
  const teachers = useTeachers(form);

  watch(
    () => course(),
    (c) => {
      if (!c) return;
      fillForm(form, c);
      economy.fillEconomy(c);
      cover.resetImage();
      access.fillAccess(c);
    },
    { immediate: true },
  );

  async function submit(): Promise<ICourse | null> {
    error.value = '';
    loading.value = true;
    try {
      const data: ICreateCourseInput = {
        ...form,
        image: await cover.imagePayload(),
        external_ref: access.isPlatform.value ? form.external_ref : '',
        guarantee_days: Number(economy.guaranteeDays.value || 0),
        ...economy.economyParams.value,
      };
      const current = course();
      const saved = current ? await updateCourse({ ...data, id: current.id }) : await createCourse(data);
      SuccessAlert(current ? 'Курс сохранён' : 'Курс добавлен');
      return saved;
    } catch (e) {
      FailAlert(e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { symbol, loading, error, form, ...cover, ...economy, ...feePreview, ...access, ...teachers, submit };
}

export type CourseFormState = ReturnType<typeof createCourseFormState>;

const COURSE_FORM_KEY: InjectionKey<CourseFormState> = Symbol('edubridge-course-form');

/** Страница заводит состояние один раз — все шаги формы работают с ним. */
export function provideCourseForm(course: CourseSource): CourseFormState {
  const state = createCourseFormState(course);
  provide(COURSE_FORM_KEY, state);
  return state;
}

export function injectCourseForm(): CourseFormState | null {
  return inject(COURSE_FORM_KEY, null);
}
