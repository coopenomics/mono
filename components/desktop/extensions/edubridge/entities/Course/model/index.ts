import { Zeus, type Mutations, type Queries } from '@coopenomics/sdk';
import { t } from '../../../i18n';

export type ICatalogCourse = Queries.Edubridge.Catalog.IOutput['edubridgeCatalog']['items'][number];
export type ICourse = Queries.Edubridge.Courses.IOutput['edubridgeCourses']['items'][number];

export type ICatalogInput = Queries.Edubridge.Catalog.IInput;
export type ICoursesInput = Queries.Edubridge.Courses.IInput;
export type ICreateCourseInput = Mutations.Edubridge.CreateCourse.IInput['data'];
export type IUpdateCourseInput = Mutations.Edubridge.UpdateCourse.IInput['data'];
export type ISetCourseStatusInput = Mutations.Edubridge.SetCourseStatus.IInput['data'];
export type ITeacherOption = Queries.Edubridge.TeacherOptions.IOutput['edubridgeTeacherOptions'][number];
export type IPlatformCourse = Queries.Edubridge.PlatformCourses.IOutput['edubridgePlatformCourses'][number];

/**
 * Подписи состояний, носителей и направлений. Ключи — имена enum'ов схемы
 * (`Zeus.*`): GraphQL отдаёт и принимает именно их, а не внутренние значения.
 */
export const COURSE_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neutral' | 'warn' }> = {
  [Zeus.EduCourseStatus.DRAFT]: { label: t('edubridge.course.status.DRAFT'), variant: 'neutral' },
  [Zeus.EduCourseStatus.PUBLISHED]: { label: t('edubridge.course.status.PUBLISHED'), variant: 'pos' },
  [Zeus.EduCourseStatus.ARCHIVED]: { label: t('edubridge.course.status.ARCHIVED'), variant: 'warn' },
};

export const CARRIER_LABELS: Record<string, string> = {
  [Zeus.EduAccessCarrier.SKILLSPACE]: 'Skillspace',
  [Zeus.EduAccessCarrier.GETCOURSE]: 'GetCourse',
  [Zeus.EduAccessCarrier.TELEGRAM]: 'Telegram',
  [Zeus.EduAccessCarrier.VK]: t('edubridge.course.carrier.VK'),
  [Zeus.EduAccessCarrier.ONSITE]: t('edubridge.course.carrier.ONSITE'),
};

export const DIRECTION_LABELS: Record<string, string> = {
  [Zeus.EduCourseDirection.ONLINE_PLATFORM]: t('edubridge.course.direction.ONLINE_PLATFORM'),
  [Zeus.EduCourseDirection.CLOSED_COMMUNITY]: t('edubridge.course.direction.CLOSED_COMMUNITY'),
  [Zeus.EduCourseDirection.ONSITE]: t('edubridge.course.direction.ONSITE'),
};

/**
 * Какие носители возможны при выбранном направлении — то же правило, что и на
 * сервере: онлайн-платформа → площадки с API, сообщество → мессенджеры, очное → очно.
 */
export const CARRIERS_BY_DIRECTION: Record<Zeus.EduCourseDirection, Zeus.EduAccessCarrier[]> = {
  [Zeus.EduCourseDirection.ONLINE_PLATFORM]: [Zeus.EduAccessCarrier.SKILLSPACE, Zeus.EduAccessCarrier.GETCOURSE],
  [Zeus.EduCourseDirection.CLOSED_COMMUNITY]: [Zeus.EduAccessCarrier.TELEGRAM, Zeus.EduAccessCarrier.VK],
  [Zeus.EduCourseDirection.ONSITE]: [Zeus.EduAccessCarrier.ONSITE],
};

/**
 * Направления, которые форма курса предлагает сейчас. Закрытое сообщество и
 * очное обучение скрыты решением владельца 22.10.2026: у Telegram и ВКонтакте
 * нет коннектора выдачи доступа, очный пропуск не выстроен и станет отдельным
 * приложением. Сервер прежние направления принимает — на них стоят курсы
 * прошлых лет и тестовые стенды. Вернуть направление — дописать его в список.
 */
export const OPEN_DIRECTIONS: Zeus.EduCourseDirection[] = [Zeus.EduCourseDirection.ONLINE_PLATFORM];

/** Носители скрытых направлений: страница площадок их карточек не показывает. */
export const HIDDEN_CARRIERS: Zeus.EduAccessCarrier[] = (Object.keys(CARRIERS_BY_DIRECTION) as Zeus.EduCourseDirection[])
  .filter((d) => !OPEN_DIRECTIONS.includes(d))
  .flatMap((d) => CARRIERS_BY_DIRECTION[d]);

/** Носители, у которых есть идентификатор курса на площадке. */
export const PLATFORM_CARRIERS: Zeus.EduAccessCarrier[] = [Zeus.EduAccessCarrier.SKILLSPACE, Zeus.EduAccessCarrier.GETCOURSE];

/** Обложка курса: те же пределы, что у bucket'а `edubridge:images` на сервере. */
export const COURSE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const COURSE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Раздел с уровнем одной строкой: «Математика · 7 класс». Уровень
 * необязателен — без него остаётся раздел, без висящего разделителя.
 */
export function courseSectionLabel(section: string | null | undefined, level: string | null | undefined, separator = ' · '): string {
  return [section, level].map((v) => (v ?? '').trim()).filter(Boolean).join(separator);
}
