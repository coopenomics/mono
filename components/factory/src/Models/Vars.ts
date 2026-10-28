import type { Cooperative } from 'cooptypes'
import DataService from '../Services/Databazor/DataService'
import type { IFactoryStorage, Where } from '../Storage'
import { type ValidateResult, Validator } from '../Services/Validator'
import { VarsSchema } from '../Schema'
import { getCurrentBlock } from '../Utils/getCurrentBlock'

export type IVars = Cooperative.Model.IVars

export class Vars {
  data?: IVars
  private data_service: DataService<IVars>

  constructor(storage: IFactoryStorage, data?: IVars) {
    this.data = data
    this.data_service = new DataService<IVars>(storage, 'vars')
  }

  validate(): ValidateResult {
    return new Validator(VarsSchema, this.data).validate()
  }

  async save(): Promise<{ insertedId: string }> {
    await this.validate()

    if (!this.data)
      throw new Error('Данные переменных не предоставлены для сохранения')

    const currentBlock = await getCurrentBlock()

    const covar: IVars = {
      ...this.data,
      deleted: false,
      block_num: currentBlock,
    }

    return await this.data_service.save(covar)
  }

  async getOne(filter: Where): Promise<IVars | null> {
    return this.data_service.getOne(filter)
  }

  async getMany(filter: Where): Promise<Cooperative.Document.IGetResponse<IVars>> {
    return this.data_service.getMany(filter, 'coopname') // группировка по coopname
  }

  async getHistory(filter: Where): Promise<IVars[]> {
    return this.data_service.getHistory(filter)
  }

  async update(filter: Where, updateData: Partial<IVars>): Promise<{ modifiedCount: number }> {
    return this.data_service.updateMany(filter, updateData)
  }

  async del(filter: Where): Promise<{ modifiedCount: number }> {
    return this.data_service.updateMany(filter, { deleted: true })
  }
}
