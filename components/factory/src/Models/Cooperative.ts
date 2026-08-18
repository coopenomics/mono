import { RegistratorContract, SovietContract } from 'cooptypes'
import type { Cooperative as CooperativeApi } from 'cooptypes'
import { type ValidateResult, Validator } from '../Services/Validator'
import DataService from '../Services/Databazor/DataService'
import type { MongoDBConnector } from '../Services/Databazor'
import type { IBankAccount } from '../Interfaces/BankAccounts'
import { getFetch } from '../Utils/getFetch'
import { getEnvVar } from '../config'
import { CooperativeSchema } from '../Schema/CooperativeSchema'
import { Organization } from './Organization'
import { PaymentMethod } from './PaymentMethod'
import type { ExternalIndividualData } from './Individual'
import { Individual } from './Individual'
import type { IChainDataSource } from '../DataSource'

export type CooperativeData = CooperativeApi.Model.ICooperativeData
export type MembersData = CooperativeApi.Model.MembersData

export class Cooperative {
  cooperative: CooperativeData | null
  db: MongoDBConnector

  private data_service: DataService<CooperativeData>

  /**
   * Источник данных цепи передаётся снаружи: модель не должна знать, откуда
   * читаются реквизиты кооператива — из базы узла или прямыми запросами.
   */
  constructor(storage: MongoDBConnector, private readonly chain: IChainDataSource) {
    this.db = storage
    this.cooperative = null
    this.data_service = new DataService<CooperativeData>(storage, 'cooperatives')
  }

  async getOne(username: string, block_num?: number): Promise<CooperativeData> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const organizationPrivateData = await new Organization(this.db).getOne({ username, ...block_filter })

    if (!organizationPrivateData)
      throw new Error('Информация о организации не обнаружена в базе данных.')

    const cooperativeBlockchainData = (await this.chain.getTableRows<RegistratorContract.Tables.Cooperatives.ICooperative>({
      code: RegistratorContract.contractName.production,
      scope: RegistratorContract.contractName.production,
      table: RegistratorContract.Tables.Cooperatives.tableName,
      filter: { username },
      ...(block_num ? { block_num } : {}),
      limit: 1,
    }))[0]

    if (!cooperativeBlockchainData)
      throw new Error('Информация о кооперативе не обнаружена в базе данных.')

    // Преобразование числовых флагов из блокчейна в boolean
    const mappedCooperativeData = {
      ...cooperativeBlockchainData,
      is_cooperative: Boolean(cooperativeBlockchainData.is_cooperative),
      is_branched: Boolean(cooperativeBlockchainData.is_branched),
      is_enrolled: Boolean(cooperativeBlockchainData.is_enrolled),
    }

    const soviet = (await this.chain.getTableRows<SovietContract.Tables.Boards.IBoards>({
      code: SovietContract.contractName.production,
      scope: username,
      table: SovietContract.Tables.Boards.tableName,
      filter: { type: 'soviet' },
      ...(block_num ? { block_num } : {}),
      limit: 1,
    }))[0]

    if (!soviet)
      throw new Error('Совет кооператива не обнаружен в базе данных.')

    const userModel = new Individual(this.db)

    const members = [] as MembersData[]
    let chairman = {} as ExternalIndividualData

    for (const member of soviet.members) {
      const userData = await userModel.getOne({ username: member.username, ...block_filter }) as ExternalIndividualData
      if (!userData)
        throw new Error(`Пользователь ${member.username} не найден в базе данных.`)

      members.push({ ...member, ...userData, is_chairman: member.position === 'chairman' })

      if (member.position === 'chairman')
        chairman = { ...member, ...userData }
    }

    // Получение дефолтного банковского счета
    const paymentMethodModel = new PaymentMethod(this.db)
    const defaultBankAccountData = await paymentMethodModel.getOne({
      username,
      is_default: true,
      method_type: 'bank_transfer',
      deleted: false,
      ...block_filter,
    })

    if (!defaultBankAccountData) {
      throw new Error('Дефолтный банковский счет кооператива не найден в базе данных.')
    }

    const defaultBankAccount = defaultBankAccountData.data as IBankAccount

    this.cooperative = {
      ...organizationPrivateData,
      ...mappedCooperativeData,
      chairman,
      members,
      totalMembers: members.length,
      defaultBankAccount,
    }

    this.validate()

    return this.cooperative
  }

  validate(): ValidateResult {
    return new Validator(CooperativeSchema, this.cooperative as CooperativeData).validate()
  }
}
