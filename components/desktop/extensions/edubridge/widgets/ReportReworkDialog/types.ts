import type { IContribution, ILesson } from '../../entities/Teacher';

/** Взнос, возвращённый на доработку, с занятиями, за которые он заведён. */
export interface IReworkTarget {
  contribution: IContribution;
  lessons: ILesson[];
}
