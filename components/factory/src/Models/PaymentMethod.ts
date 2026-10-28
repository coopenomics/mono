import type { Cooperative } from 'cooptypes'
import type { ValidateResult } from '../Services/Validator'
import { Validator } from '../Services/Validator'
import DataService from '../Services/Databazor/DataService'
import type { IFactoryStorage, Where } from '../Storage'
import type { IPaymentData } from '../Interfaces'
import { paymentMethodSchema } from '../Schema'
import { getCurrentBlock } from '../Utils/getCurrentBlock'

export type PaymentData = IPaymentData

export class PaymentMethod {
  db: IFactoryStorage
  paymentMethod?: PaymentData
  private data_service: DataService<PaymentData>

  constructor(storage: IFactoryStorage, data?: PaymentData) {
    this.db = storage
    this.paymentMethod = data
    this.data_service = new DataService(storage, 'paymentMethods')
  }

  validate(): ValidateResult {
    return new Validator(paymentMethodSchema, this.paymentMethod).validate()
  }

  async save(): Promise<{ insertedId: string }> {
    await this.validate()

    if (!this.paymentMethod)
      throw new Error('Данные платежного метода не предоставлены для сохранения')

    this.paymentMethod.deleted = false
    this.paymentMethod.block_num = await getCurrentBlock()

    return await this.data_service.save(this.paymentMethod)
  }

  async getOne(filter: Where): Promise<PaymentData | null> {
    const result = await this.data_service.getOne(filter)

    return result
  }

  async getMany(filter: Where): Promise<Cooperative.Document.IGetResponse<PaymentData>> {
    return this.data_service.getMany({ deleted: false, ...filter }, ['username', 'method_id'])
  }

  async getHistory(filter: Where): Promise<PaymentData[]> {
    return this.data_service.getHistory(filter)
  }

  async del(filter: Where): Promise<{ modifiedCount: number }> {
    return this.data_service.updateMany({ ...filter, deleted: false }, { deleted: true })
  }
}
