import type { Cooperative } from 'cooptypes'
import type { ValidateResult } from '../Services/Validator'
import { Validator } from '../Services/Validator'
import DataService from '../Services/Databazor/DataService'
import type { IFactoryStorage, Where } from '../Storage'
import { organizationSchema } from '../Schema'
import { getCurrentBlock } from '../Utils/getCurrentBlock'

export type ExternalOrganizationData = Cooperative.Users.IOrganizationData

export type InternalOrganizationData = Cooperative.Users.IOrganizationData
// Omit<ExternalOrganizationData, 'bank_account'> & {
//   bank_account?: Cooperative.Payments.IBankAccount
// }

export class Organization {
  db: IFactoryStorage
  organization?: ExternalOrganizationData
  private data_service: DataService<InternalOrganizationData>

  constructor(storage: IFactoryStorage, data?: ExternalOrganizationData) {
    this.db = storage
    this.organization = data
    this.data_service = new DataService<InternalOrganizationData>(storage, 'organizations')
  }

  validate(): ValidateResult {
    return new Validator(organizationSchema, this.organization as ExternalOrganizationData).validate()
  }

  async save(): Promise<{ insertedId: string }> {
    await this.validate()

    if (!this.organization)
      throw new Error('Данные организации не предоставлены для сохранения')

    const { ...organization_for_save } = this.organization
    const currentBlock = await getCurrentBlock()

    const orgForSave: InternalOrganizationData = {
      ...organization_for_save,
      deleted: false,
      block_num: currentBlock,
    }

    return await this.data_service.save(orgForSave)
  }

  async getOne(filter: Where): Promise<ExternalOrganizationData | null> {
    const org = await this.data_service.getOne(filter)

    return org as ExternalOrganizationData
  }

  async getMany(filter: Where): Promise<Cooperative.Document.IGetResponse<ExternalOrganizationData>> {
    const response = (await this.data_service.getMany({ deleted: false, ...filter }, 'username'))
    const orgs = response.results

    const result: Cooperative.Document.IGetResponse<ExternalOrganizationData> = {
      results: orgs as ExternalOrganizationData[],
      page: response.page,
      limit: response.limit,
      totalResults: response.totalResults,
      totalPages: response.totalPages,
    }

    return result
  }

  async getHistory(filter: Where): Promise<ExternalOrganizationData[]> {
    const orgs = await this.data_service.getHistory(filter)

    return orgs as ExternalOrganizationData[]
  }

  async del(filter: Where): Promise<{ modifiedCount: number }> {
    return this.data_service.updateMany({ ...filter }, { deleted: true })
  }
}
