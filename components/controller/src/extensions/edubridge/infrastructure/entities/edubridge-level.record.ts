import { EdubridgeSectionRecord } from './edubridge-section.record';

/**
 * Уровень внутри раздела: «7 класс», «Ступень 1». Порядок уровней в разделе —
 * их последовательность: на нём строятся правила, какой уровень открывается
 * после какого.
 */
export class EdubridgeLevelRecord {
  public id!: string;

  public coopname!: string;

  public section_id!: string;

  public section?: EdubridgeSectionRecord;

  public title!: string;

  /** Место уровня в последовательности раздела: меньше — раньше. */
  public sort_order!: number;

  /** В архиве: не предлагается новым курсам и в каталоге, у старых курсов остаётся. */
  public archived!: boolean;

  public created_at!: Date;

  public updated_at!: Date;
}
