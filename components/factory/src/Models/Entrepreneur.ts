import type { Cooperative } from 'cooptypes'
import type { ValidateResult } from '../Services/Validator'
import { Validator } from '../Services/Validator'
import DataService from '../Services/Databazor/DataService'
import type { IFactoryStorage, Where } from '../Storage'
import { entrepreneurSchema } from '../Schema/EntrepreneurSchema'
import { getCurrentBlock } from '../Utils/getCurrentBlock'

export type ExternalEntrepreneurData = Cooperative.Users.IEntrepreneurData

export type InternalEntrepreneurData = Omit<ExternalEntrepreneurData, 'bank_account'> & {
  bank_account?: Cooperative.Payments.IBankAccount
}

export class Entrepreneur {
  db: IFactoryStorage
  entrepreneur?: ExternalEntrepreneurData
  private data_service: DataService<InternalEntrepreneurData>

  constructor(storage: IFactoryStorage, data?: ExternalEntrepreneurData) {
    this.db = storage
    this.entrepreneur = data
    this.data_service = new DataService<InternalEntrepreneurData>(storage, 'entrepreneurs')
  }

  validate(): ValidateResult {
    return new Validator(entrepreneurSchema, this.entrepreneur).validate()
  }

  async save(): Promise<{ insertedId: string }> {
    await this.validate()

    if (!this.entrepreneur)
      throw new Error('Данные ИП не предоставлены для сохранения')

    const { ...entr_for_save } = this.entrepreneur

    const currentBlock = await getCurrentBlock()

    const entrForSave: InternalEntrepreneurData = {
      ...entr_for_save,
      deleted: false,
      block_num: currentBlock,
    }

    return await this.data_service.save(entrForSave)
  }

  async getOne(filter: Where): Promise<ExternalEntrepreneurData | null> {
    const entr = await this.data_service.getOne(filter)
    return entr as ExternalEntrepreneurData
  }

  async getMany(filter: Where): Promise<Cooperative.Document.IGetResponse<ExternalEntrepreneurData>> {
    const response = await this.data_service.getMany({ deleted: false, ...filter }, 'username')
    const entrepreneurs = response.results

    const result: Cooperative.Document.IGetResponse<ExternalEntrepreneurData> = {
      results: entrepreneurs as ExternalEntrepreneurData[],
      page: response.page,
      limit: response.limit,
      totalResults: response.totalResults,
      totalPages: response.totalPages,
    }

    return result
  }

  async getHistory(filter: Where): Promise<ExternalEntrepreneurData[]> {
    const history = await this.data_service.getHistory(filter)

    return history as ExternalEntrepreneurData[]
  }

  async del(filter: Where): Promise<{ modifiedCount: number }> {
    return this.data_service.updateMany({ ...filter, deleted: false }, { deleted: true })
  }
}
