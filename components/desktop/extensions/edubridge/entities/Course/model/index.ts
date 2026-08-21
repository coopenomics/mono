import type { Mutations, Queries } from '@coopenomics/sdk';

export type ICatalogCourse = Queries.Edubridge.Catalog.IOutput['edubridgeCatalog']['items'][number];
export type ICatalogSubject = Queries.Edubridge.CatalogSubjects.IOutput['edubridgeCatalogSubjects'][number];
export type ICourse = Queries.Edubridge.Courses.IOutput['edubridgeCourses']['items'][number];

export type ICatalogInput = Queries.Edubridge.Catalog.IInput;
export type ICoursesInput = Queries.Edubridge.Courses.IInput;
export type ICreateCourseInput = Mutations.Edubridge.CreateCourse.IInput['data'];
export type IUpdateCourseInput = Mutations.Edubridge.UpdateCourse.IInput['data'];
export type ISetCourseStatusInput = Mutations.Edubridge.SetCourseStatus.IInput['data'];

/** Подписи состояний курса для владельца. */
export const COURSE_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neutral' | 'warn' }> = {
  draft: { label: 'Черновик', variant: 'neutral' },
  published: { label: 'Опубликован', variant: 'pos' },
  archived: { label: 'В архиве', variant: 'warn' },
};

export const CARRIER_LABELS: Record<string, string> = {
  skillspace: 'Skillspace',
  getcourse: 'GetCourse',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
  onsite: 'Очно',
};

export const DIRECTION_LABELS: Record<string, string> = {
  online_platform: 'Онлайн-платформа',
  closed_community: 'Закрытое сообщество',
  onsite: 'Очное обучение',
};
