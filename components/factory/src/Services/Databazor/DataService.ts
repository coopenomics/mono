import type { Cooperative } from 'cooptypes'
import type { IFactoryStorage, RecordCollection, Where } from '../../Storage'

export interface IDocument {
  [key: string]: any
}

/**
 * Версионированные записи одной коллекции поверх порта хранилища (шаг 5
 * фабрики v2). Правила версий — у порта: текущая запись последняя по блоку,
 * при равном блоке последняя вставленная; удаление помечает все версии.
 */
class DataService<T extends IDocument> {
  constructor(
    private readonly storage: IFactoryStorage,
    private readonly collection: RecordCollection,
  ) {}

  async getOne(filter: Where): Promise<T | null> {
    return this.storage.findOne<T>(this.collection, filter)
  }

  async getMany(
    filter: Where,
    groupByFields: string | string[],
    page: number = 1,
    limit: number = 100,
  ): Promise<Cooperative.Document.IGetResponse<T>> {
    const groupFields = Array.isArray(groupByFields) ? groupByFields : [groupByFields]
    return this.storage.findLatestPerGroup<T>(this.collection, filter, groupFields, page, limit)
  }

  async getHistory(filter: Where): Promise<T[]> {
    return this.storage.findAll<T>(this.collection, filter)
  }

  async save(data: T): Promise<{ insertedId: string }> {
    return this.storage.insert(this.collection, data)
  }

  async updateMany(filter: Where, dataForUpdate: Partial<T>): Promise<{ modifiedCount: number }> {
    return this.storage.updateMany(this.collection, filter, dataForUpdate)
  }
}

export default DataService
