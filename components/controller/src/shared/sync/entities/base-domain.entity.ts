import type { IBaseDatabaseData } from '../interfaces/base-database.interface';
import { randomUUID } from 'crypto';

/**
 * Базовый класс для доменных сущностей
 *
 * Предоставляет общую логику для всех доменных сущностей:
 * - Генерация _id при необходимости
 * - Установка базовых полей из IBaseDatabaseData
 */
export abstract class BaseDomainEntity<T extends IBaseDatabaseData> {
  // Базовые поля из IBaseDatabaseData
  public _id: string; // Внутренний ID базы данных
  public block_num?: number; // Номер блока последнего обновления
  public present: boolean; // Существует ли запись в блокчейне
  public status?: string; // Статус сущности
  public _created_at: Date; // Дата создания в базе данных
  public _updated_at: Date; // Дата последнего обновления в базе данных

  /**
   * Конструктор базового класса
   *
   * @param databaseData - данные из базы данных
   * @param defaultStatus - статус по умолчанию, если не указан
   */
  constructor(databaseData: T, defaultStatus?: string) {
    // Генерация _id если он пустой
    this._id = databaseData._id === '' ? randomUUID().toString() : databaseData._id;

    // Установка базовых полей
    this.block_num = databaseData.block_num ?? 0;
    this.present = databaseData.present;
    this.status = databaseData.status ?? defaultStatus;
    this._created_at = databaseData._created_at ? new Date(databaseData._created_at) : new Date();
    this._updated_at = databaseData._updated_at ? new Date(databaseData._updated_at) : new Date();
  }

  /**
   * Обновление базовых данных сущности
   */
  updateBase(data: Partial<T>): void {
    if (data.block_num !== undefined) this.block_num = data.block_num;
    if (data.present !== undefined) this.present = data.present;
    if (data.status !== undefined) this.status = data.status;
    if (data._created_at !== undefined) this._created_at = data._created_at;
    if (data._updated_at !== undefined) this._updated_at = data._updated_at;
  }
}
