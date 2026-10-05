import { EdubridgeLevelRecord } from './edubridge-level.record';

/**
 * Раздел каталога — область знаний: «Математика», «Духовные практики».
 * Справочник ведёт администратор образования; курс ссылается на раздел, а не
 * хранит его строкой — раздел переименовывается и упорядочивается один раз
 * для всех курсов.
 */
export class EdubridgeSectionRecord {
  public id!: string;

  public coopname!: string;

  public title!: string;

  /** Порядок в каталоге и форме курса: меньше — выше. */
  public sort_order!: number;

  /** В архиве: не предлагается новым курсам и в каталоге, у старых курсов остаётся. */
  public archived!: boolean;

  public levels?: EdubridgeLevelRecord[];

  public created_at!: Date;

  public updated_at!: Date;
}
