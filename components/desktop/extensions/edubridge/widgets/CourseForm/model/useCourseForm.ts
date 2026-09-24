import { computed, inject, onBeforeUnmount, onMounted, provide, reactive, ref, watch, type ComputedRef, type InjectionKey } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { fileToBase64, formatToAsset } from 'src/shared/lib/utils';
import { courseMonthsLabel as courseMonthsText } from '../../../shared/lib/courseMonths';
import { fetchCourseFeePreview, fetchEconomySettings, type ICourseFee } from '../../../entities/Economy';
import {
  CARRIER_LABELS,
  CARRIERS_BY_DIRECTION,
  COURSE_IMAGE_MAX_BYTES,
  DIRECTION_LABELS,
  PLATFORM_CARRIERS,
  createCourse,
  fetchCourses,
  fetchPlatformCourses,
  fetchTeacherOptions,
  updateCourse,
  type ICourse,
  type ICreateCourseInput,
  type IPlatformCourse,
  type ITeacherOption,
} from '../../../entities/Course';
import { COURSE_FORM_HELP } from './courseFormHelp';
import { fetchSections, saveLevel, saveSection, type ISection } from '../../../entities/Section';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../../shared/lib/live';
import { t as i18nT } from '../../../i18n';

/** Разделы формы курса: на полной странице каждый — отдельный шаг. */
export type CourseFormSection = 'course' | 'cover' | 'price' | 'access' | 'teachers';

type CourseSource = () => ICourse | null | undefined;
type CourseFormFields = ICreateCourseInput & { teacher_usernames: string[] };

function emptyForm(): CourseFormFields {
  return reactive<CourseFormFields>({
    title: '',
    section_id: '',
    level_id: null,
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

/** Выбранная обложка в виде данных — так её можно показать, отправить и сохранить в черновике. */
interface PickedImage {
  base64: string;
  mime_type: string;
}

/**
 * Бюджет обложки в черновике (длина base64). В localStorage около 5 МБ на
 * сайт; обложка крупнее в черновик не идёт, чтобы не потерять из-за неё поля.
 */
const MAX_DRAFT_COVER_CHARS = 1_500_000;

/**
 * Обложка: новый файл, снятие, либо без изменений. Файл сразу читается в
 * данные: превью строится из них, и они же переживают уход со страницы в
 * черновике — объект File после перезагрузки не восстановить.
 */
function useCover(course: CourseSource) {
  const picked = ref<PickedImage | null>(null);
  const imageRemoved = ref(false);
  const fileInput = ref<HTMLInputElement | null>(null);
  const previewUrl = computed(() => {
    if (picked.value) return `data:${picked.value.mime_type};base64,${picked.value.base64}`;
    return imageRemoved.value ? null : (course()?.image_url ?? null);
  });
  // Для черновика: крупная обложка не сохраняется, остальное — как есть.
  const draftCover = computed<PickedImage | null>({
    get: () => (picked.value && picked.value.base64.length <= MAX_DRAFT_COVER_CHARS ? picked.value : null),
    set: (v) => {
      if (v?.base64 && v.mime_type) picked.value = v;
    },
  });

  function pickImage(): void {
    fileInput.value?.click();
  }
  async function onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    if (file.size > COURSE_IMAGE_MAX_BYTES) {
      FailAlert(new Error(i18nT('edubridge.error.courseCoverTooLarge', { maxMegabytes: Math.round(COURSE_IMAGE_MAX_BYTES / (1024 * 1024)) })));
      return;
    }
    try {
      picked.value = { base64: await fileToBase64(file), mime_type: file.type };
      imageRemoved.value = false;
    } catch (e) {
      FailAlert(e);
    }
  }
  function removeImage(): void {
    picked.value = null;
    imageRemoved.value = true;
  }
  function resetImage(): void {
    picked.value = null;
    imageRemoved.value = false;
  }
  function imagePayload(): ICreateCourseInput['image'] {
    if (picked.value) return { ...picked.value };
    if (imageRemoved.value) return null;
    return undefined;
  }

  return { previewUrl, fileInput, pickImage, onFilePicked, removeImage, resetImage, imagePayload, draftCover, imageRemoved };
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
      ? i18nT('edubridge.useCourseForm.discountTooLargeError')
      : '',
  );
  const discountHint = computed(() =>
    fee.value ? i18nT('edubridge.useCourseForm.discountHintWithLimit', { markupPercent: fee.value.markup_percent, maxDiscountPercent: fee.value.max_course_discount_percent }) : i18nT('edubridge.useCourseForm.discountHint'),
  );
  /** Длительность курса следует из программы: занятий в программе на занятий в месяц. */
  const courseMonthsLabel = computed(() => courseMonthsText(fee.value?.course_months));
  const coursePaymentHint = computed(() =>
    courseMonthsLabel.value
      ? i18nT('edubridge.useCourseForm.coursePaymentHintWithMonths', { coursePaymentHelp: COURSE_FORM_HELP.coursePayment, courseMonths: courseMonthsLabel.value })
      : COURSE_FORM_HELP.coursePayment,
  );
  const courseFeeShown = computed(() => coursePayment.value && (fee.value?.course_months ?? 0) > 0);
  const courseFeeLabel = computed(() => (courseFeeShown.value ? i18nT('edubridge.useCourseForm.courseFeeLabelWithMonths', { courseMonths: courseMonthsLabel.value }) : i18nT('edubridge.useCourseForm.courseFeeLabel')));

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
      // timing: debounce — взнос пересчитывается, когда ввод утих, а не на каждую букву.
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

  // Группа чужого курса сбрасывается, но только когда реестр школы уже пришёл:
  // курс и группа из сохранённого курса или черновика ставятся раньше реестра.
  watch(skillspaceCourseId, () => {
    if (!platformCourses.value.length) return;
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
    platformCourseOptions,
    platformGroupOptions,
    fillAccess,
  };
}

/**
 * Раздел и уровень — из справочника «Разделы и уровни» (7DD-23). Выбирают из
 * списка, а новое вводом: оно сразу становится записью справочника, так один
 * предмет не расходится на два написания. Уровни — выбранного раздела, в их
 * последовательности. Архивное предлагается только у курса, где оно уже стоит.
 */
function useTaxonomy(form: CourseFormFields) {
  const sections = ref<ISection[]>([]);
  const reload = async () => {
    sections.value = await fetchSections({ include_archived: true });
  };
  const sectionOptions = computed(() =>
    sections.value.filter((s) => !s.archived || s.id === form.section_id).map((s) => ({ value: String(s.id), label: s.title })),
  );
  const levelOptions = computed(() =>
    (sections.value.find((s) => s.id === form.section_id)?.levels ?? [])
      .filter((l) => !l.archived || l.id === form.level_id)
      .map((l) => ({ value: String(l.id), label: l.title })),
  );

  /** Выбран раздел из списка либо введён новый — тогда он добавляется в справочник. */
  async function pickSection(value: unknown): Promise<void> {
    const v = value === null || value === undefined ? '' : String(value);
    if (!v) {
      form.section_id = '';
      form.level_id = null;
      return;
    }
    const known = sections.value.find((s) => s.id === v);
    const id = known ? String(known.id) : await create(() => saveSection({ title: v }));
    if (!id) return;
    if (form.section_id !== id) form.level_id = null;
    form.section_id = id;
  }

  /** Выбран уровень раздела либо введён новый — он добавляется в раздел. */
  async function pickLevel(value: unknown): Promise<void> {
    const v = value === null || value === undefined ? '' : String(value);
    if (!v) {
      form.level_id = null;
      return;
    }
    const section = sections.value.find((s) => s.id === form.section_id);
    if (!section) return;
    const known = section.levels.find((l) => l.id === v);
    const id = known ? String(known.id) : await create(() => saveLevel({ section_id: String(section.id), title: v }));
    if (id) form.level_id = id;
  }

  async function create(save: () => Promise<{ id: unknown }>): Promise<string | null> {
    try {
      const created = await save();
      await reload();
      return String(created.id);
    } catch (e) {
      FailAlert(e);
      return null;
    }
  }

  onMounted(async () => {
    try {
      await reload();
    } catch (e) {
      FailAlert(e);
    }
  });
  // Администратор правит справочник — форма видит новые названия и порядок сразу.
  useLiveReload([EduLive.sections, EduLive.levels], reload);

  return { sectionOptions, levelOptions, pickSection, pickLevel };
}

/**
 * Целевой членский взнос кооператива — один на все курсы, задаётся в разделе
 * «Экономика». Форма показывает его сразу, до расчёта взноса курса.
 */
function useMembershipFee() {
  const markupPercent = ref<number | null>(null);
  onMounted(async () => {
    try {
      markupPercent.value = (await fetchEconomySettings()).markup_percent;
    } catch (e) {
      FailAlert(e);
    }
  });
  return { markupPercent };
}

/** Преподаватели — пайщики с подписанным договором УХД, их может быть несколько. */
function useTeachers(form: CourseFormFields) {
  const teachers = ref<ITeacherOption[]>([]);
  // В списке — имя человека и номер его договора: учётное имя администратору
  // ничего не говорит, а договор отличает однофамильцев.
  const teacherOptions = computed(() =>
    teachers.value
      .filter((t) => !form.teacher_usernames.includes(t.username))
      .map((t) => ({ value: t.username, label: i18nT('edubridge.useCourseForm.teacherOption', { teacherName: t.display_name || t.username, contractNumber: t.contract_number }) })),
  );
  const teacherName = (username: string) => teachers.value.find((t) => t.username === username)?.display_name || null;
  const teacherHint = computed(() =>
    teachers.value.length
      ? i18nT('edubridge.useCourseForm.teacherHint')
      : i18nT('edubridge.useCourseForm.noTeachersHint'),
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
    section_id: c.section_id ?? '',
    level_id: c.level_id ?? null,
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
  const taxonomy = useTaxonomy(form);
  const membershipFee = useMembershipFee();

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
        image: cover.imagePayload(),
        external_ref: access.isPlatform.value ? form.external_ref : '',
        guarantee_days: Number(economy.guaranteeDays.value || 0),
        ...economy.economyParams.value,
      };
      const current = course();
      const saved = current ? await updateCourse({ ...data, id: current.id }) : await createCourse(data);
      SuccessAlert(current ? i18nT('edubridge.useCourseForm.savedSuccess') : i18nT('edubridge.useCourseForm.createdSuccess'));
      return saved;
    } catch (e) {
      FailAlert(e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { symbol, loading, error, form, ...cover, ...economy, ...feePreview, ...access, ...teachers, ...taxonomy, ...membershipFee, submit };
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
