import { Zeus, type Mutations, type Queries } from '@coopenomics/sdk';

export type ICatalogCourse = Queries.Edubridge.Catalog.IOutput['edubridgeCatalog']['items'][number];
export type ICatalogSubject = Queries.Edubridge.CatalogSubjects.IOutput['edubridgeCatalogSubjects'][number];
export type ICourse = Queries.Edubridge.Courses.IOutput['edubridgeCourses']['items'][number];

export type ICatalogInput = Queries.Edubridge.Catalog.IInput;
export type ICoursesInput = Queries.Edubridge.Courses.IInput;
export type ICreateCourseInput = Mutations.Edubridge.CreateCourse.IInput['data'];
export type IUpdateCourseInput = Mutations.Edubridge.UpdateCourse.IInput['data'];
export type ISetCourseStatusInput = Mutations.Edubridge.SetCourseStatus.IInput['data'];
export type ITeacherOption = Queries.Edubridge.TeacherOptions.IOutput['edubridgeTeacherOptions'][number];

/**
 * Подписи состояний, носителей и направлений. Ключи — имена enum'ов схемы
 * (`Zeus.*`): GraphQL отдаёт и принимает именно их, а не внутренние значения.
 */
export const COURSE_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neutral' | 'warn' }> = {
  [Zeus.EduCourseStatus.DRAFT]: { label: 'Черновик', variant: 'neutral' },
  [Zeus.EduCourseStatus.PUBLISHED]: { label: 'Опубликован', variant: 'pos' },
  [Zeus.EduCourseStatus.ARCHIVED]: { label: 'В архиве', variant: 'warn' },
};

export const CARRIER_LABELS: Record<string, string> = {
  [Zeus.EduAccessCarrier.SKILLSPACE]: 'Skillspace',
  [Zeus.EduAccessCarrier.GETCOURSE]: 'GetCourse',
  [Zeus.EduAccessCarrier.TELEGRAM]: 'Telegram',
  [Zeus.EduAccessCarrier.VK]: 'ВКонтакте',
  [Zeus.EduAccessCarrier.ONSITE]: 'Очно',
};

export const DIRECTION_LABELS: Record<string, string> = {
  [Zeus.EduCourseDirection.ONLINE_PLATFORM]: 'Онлайн-платформа',
  [Zeus.EduCourseDirection.CLOSED_COMMUNITY]: 'Закрытое сообщество',
  [Zeus.EduCourseDirection.ONSITE]: 'Очное обучение',
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

/** Носители, у которых есть идентификатор курса на площадке. */
export const PLATFORM_CARRIERS: Zeus.EduAccessCarrier[] = [Zeus.EduAccessCarrier.SKILLSPACE, Zeus.EduAccessCarrier.GETCOURSE];
