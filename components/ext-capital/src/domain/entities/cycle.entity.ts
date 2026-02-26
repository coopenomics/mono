import { CycleStatus } from '../enums/cycle-status.enum';
import type { ICycleDatabaseData } from '../interfaces/cycle-database.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность цикла разработки
 *
 * Управляет циклами разработки проектов (спринтами)
 */
export class CycleDomainEntity extends BaseDomainEntity<ICycleDatabaseData> {
  // Специфичные поля для цикла
  public name: string; // Название цикла
  public start_date: Date; // Дата начала
  public end_date: Date; // Дата окончания
  public status: CycleStatus; // Статус цикла

  /**
   * Конструктор для создания доменной сущности
   *
   * @param databaseData - данные из базы данных
   */
  constructor(databaseData: ICycleDatabaseData) {
    // Вызываем конструктор базового класса
    super(databaseData, CycleStatus.FUTURE);

    // Устанавливаем специфичные поля цикла
    this.name = databaseData.name;
    this.start_date = databaseData.start_date;
    this.end_date = databaseData.end_date;
    this.status = databaseData.status; // Переопределяем статус с правильным типом
  }
}
