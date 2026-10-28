import type { Cooperative } from 'cooptypes'
import type { ValidateResult } from '../Services/Validator'
import { Validator } from '../Services/Validator'
import DataService from '../Services/Databazor/DataService'
import type { IFactoryStorage, Where } from '../Storage'
import { udataSchema } from '../Schema/UdataSchema'
import { getCurrentBlock } from '../Utils/getCurrentBlock'

// Используем типы из cooptypes
export type ExternalUdata = Cooperative.Model.IUdata
export type FactoryDataEnum = Cooperative.Model.UdataKey
export type InternalUdata = ExternalUdata

export class Udata {
  udata?: ExternalUdata
  private data_service: DataService<InternalUdata>

  constructor(storage: IFactoryStorage, data?: ExternalUdata) {
    this.udata = data
    this.data_service = new DataService<InternalUdata>(storage, 'udatas')
  }

  validate(): ValidateResult {
    return new Validator(udataSchema, this.udata).validate()
  }

  async save(): Promise<{ insertedId: string }> {
    await this.validate()

    if (!this.udata)
      throw new Error('Данные пользователя не предоставлены для сохранения')

    const currentBlock = await getCurrentBlock()

    const udata: InternalUdata = {
      ...this.udata,
      deleted: false,
      block_num: currentBlock,
    }

    return await this.data_service.save(udata)
  }

  async getOne(filter: Where): Promise<ExternalUdata | null> {
    // Поддержка логики с block_num - если в фильтре есть block_num,
    // ищем записи с block_num <= указанного значения
    const block_filter = ('block_num' in filter && typeof filter.block_num === 'number')
      ? { block_num: { $lte: filter.block_num } }
      : {}

    const { block_num, ...filterWithoutBlock } = filter
    const finalFilter = { ...filterWithoutBlock, ...block_filter }

    return this.data_service.getOne(finalFilter)
  }

  async getMany(filter: Where): Promise<Cooperative.Document.IGetResponse<ExternalUdata>> {
    return this.data_service.getMany(filter, ['coopname', 'username', 'key'])
  }

  async getHistory(filter: Where): Promise<ExternalUdata[]> {
    return this.data_service.getHistory(filter)
  }

  async del(filter: Where): Promise<{ modifiedCount: number }> {
    return this.data_service.updateMany(filter, { deleted: true })
  }
}
