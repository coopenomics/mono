import { Zeus } from '@coopenomics/sdk';

/** Что сейчас за преподавателем по занятию: передать материалы на хранение либо подписать акт после решения совета. */
export type LessonAction = 'transfer' | 'sign';

/** Действие по состоянию взноса занятия; `null` — ход не за преподавателем. */
export function lessonActionOf(status: string | null | undefined): LessonAction | null {
  if (status === Zeus.EduContributionStatus.DRAFT) return 'transfer';
  if (status === Zeus.EduContributionStatus.COUNCIL_APPROVED) return 'sign';
  return null;
}

/** Сколько занятий ждут действия преподавателя — число на пункте меню «Занятия». */
export function lessonActionsCount(statuses: Array<string | null | undefined>): number {
  return statuses.filter((s) => lessonActionOf(s) !== null).length;
}
