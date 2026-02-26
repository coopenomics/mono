import type { CycleStatus } from '../enums/cycle-status.enum';
import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных цикла из базы данных
 */
export interface ICycleDatabaseData extends IBaseDatabaseData {
  name: string; // Название цикла
  start_date: Date; // Дата начала
  end_date: Date; // Дата окончания
  status: CycleStatus; // Статус цикла
}
