import { TextDecoder, TextEncoder } from 'node:util' // Add missing import
import fs from 'node:fs'
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig'
import { Api, JsonRpc, Serialize } from 'eosjs'
import {
  DraftContract,
  GatewayContract,
  RegistratorContract,
  SovietContract,
  SystemContract,
  TokenContract,
} from 'cooptypes'
// @ts-expect-error заменить на antelope
import EosApi from 'eosjs-api'
// @ts-expect-error заменить на antelope
import ecc from 'eosjs-ecc'
import config from '../configs'
import { consoleIt } from '../tests/shared/consoleIt'

import type { Contract, Feature, Keys, Network } from '../types'

export default class Blockchain {
  public signatureProvider: any
  public privateKeys: any[] = []
  public api: any
  public network: Network
  public new_accounts: any[] = []

  constructor(network: Network, privateKeys: string[] = []) {
    this.network = network
    this.privateKeys = privateKeys
  }

  async update_pass_instance() {
    const protocol = this.network.protocol
    const endpoint = this.network.host
    const port = this.network.port
    const res = `${protocol}://${endpoint}${port}`

    const rpc = new JsonRpc(res, { fetch })

    const signatureProvider = new JsSignatureProvider(this.privateKeys)

    this.api = new Api({
      rpc,
      signatureProvider,
      textDecoder: new TextDecoder() as any,
      textEncoder: new TextEncoder() as any,
    })
    this.api.read = await EosApi({ httpEndpoint: res })
  }

  generateRandomUsername(): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz'
    let username = ''
    for (let i = 0; i < 12; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length)
      username += characters[randomIndex]
    }
    return username
  }

  async getInfo() {
    const result = await this.api.read.getInfo({})
    return result
  }

  async getTableRows(
    code: string,
    scope: string,
    table: string,
    limit = 10,
    lower_bound?: string,
    upper_bound?: string,
    index_position?: number,
    key_type: 'i64' | 'i128' | 'i256' | 'float64' | 'float128' | 'sha256' | 'ripemd160' = 'i64',
  ): Promise<any> {
    try {
      const result = await this.api.read.getTableRows({
        json: true,
        code,
        scope,
        table,
        limit,
        lower_bound,
        upper_bound,
        index_position,
        key_type,
      })
      return result.rows
    }
    catch (error) {
      console.error('Error fetching table rows:', error)
      throw error
    }
  }

  async generateKeypair(username?: string, keys?: Keys, memo?: string) {
    let privateKey = ''
    let publicKey = ''

    if (!username)
      username = this.generateRandomUsername()

    if (keys) {
      privateKey = keys.privateKey
      publicKey = keys.publicKey
    }
    else {
      privateKey = await ecc.randomKey()
      publicKey = await ecc.privateToPublic(privateKey)
    }

    this.privateKeys = [...this.privateKeys, privateKey]

    this.new_accounts.push({ username, privateKey, publicKey, memo })

    await this.update_pass_instance()

    console.log('\tusername: ', username)
    console.log('\tprivateKey: ', privateKey)
    console.log('\tpublicKey: ', publicKey)
    console.log('\tmemo: ', memo)

    return { username, privateKey, publicKey, memo }
  }

  async createStandartAccount(
    creator: string,
    accountName: string,
    ownerPublicKey: string,
    activePublicKey: string,
  ) {
    try {
      await this.update_pass_instance()
      const result = await this.api.transact(
        {
          actions: [
            {
              account: 'eosio',
              name: 'newaccount',
              authorization: [
                {
                  actor: creator,
                  permission: 'active',
                },
              ],
              data: {
                creator,
                name: accountName,
                owner: {
                  threshold: 1,
                  keys: [
                    {
                      key: ownerPublicKey,
                      weight: 1,
                    },
                  ],
                  accounts: [],
                  waits: [],
                },
                active: {
                  threshold: 1,
                  keys: [
                    {
                      key: activePublicKey,
                      weight: 1,
                    },
                  ],
                  accounts: [],
                  waits: [],
                },
              },
            },
          ],
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        },
      )
      console.log(`Created account: ${accountName}`)
      return result
    }
    catch (e) {
      console.error(e)
    }
  }

  async setContract(contract: Contract) {
    try {
      console.log('on set: ', contract)
      const wasm_path = `${contract.path}/${contract.name}.wasm`
      const abi_path = `${contract.path}/${contract.name}.abi`

      console.log('wasm_path', wasm_path)
      console.log('abi_path', abi_path)

      const wasm = fs.readFileSync(wasm_path)
      const abi = fs.readFileSync(abi_path)

      const buffer = new Serialize.SerialBuffer({
        textEncoder: this.api.textEncoder,
        textDecoder: this.api.textDecoder,
      })

      const abiDefinitions = this.api.abiTypes.get('abi_def')

      let abiJSON = JSON.parse(abi.toString()) // Convert the abi buffer to a string before parsing it as JSON

      abiJSON = abiDefinitions.fields.reduce(
        (acc: { [x: string]: any }, { name: fieldName }: any) =>
          Object.assign(acc, { [fieldName]: acc[fieldName] || [] }),
        abiJSON,
      )
      abiDefinitions.serialize(buffer, abiJSON)

      // eslint-disable-next-line node/prefer-global/buffer
      const serializedAbiHexString = Buffer.from(
        buffer.asUint8Array(),
      ).toString('hex')

      const data = {
        account: contract.target,
        vmtype: 0,
        vmversion: 0,
        code: wasm,
      }
      // console.log(data)
      // console.log("abi: ", serializedAbiHexString)

      await this.api.transact(
        {
          actions: [
            {
              account: 'eosio',
              name: 'setcode',
              authorization: [
                {
                  actor: contract.target,
                  permission: 'active',
                },
              ],
              data,
            },
            {
              account: 'eosio',
              name: 'setabi',
              authorization: [
                {
                  actor: contract.target,
                  permission: 'active',
                },
              ],
              data: {
                account: contract.target,
                abi: serializedAbiHexString,
              },
            },
          ],
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        },
      )
      console.log('contract setted: ', contract.target)
    }
    catch (e) {
      // Отсутствующий wasm/abi — soft warn. Контракт может быть
      // временно отключён в components/contracts/CMakeLists.txt на
      // другой ветке (например ledger2 пока в reports), и dicoop/contracts
      // его не содержит. Это нормально для in-progress feature-веток.
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
        console.warn(
          `[setContract] SKIPPED '${contract.name}' on '${contract.target}': artifact missing at ${contract.path}`,
        )
        return
      }
      // Всё остальное (RPC errors, transaction failures, abi parse) —
      // fail-fast: sideboot не должен молча отдавать "готовую" цепь
      // с дырами в развёртывании.
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(
        `Failed to set contract '${contract.name}' on '${contract.target}' (path: ${contract.path}): ${msg}`,
        { cause: e },
      )
    }
  }

  async activateFeature(feature: Feature) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: 'eosio',
            name: 'activate',
            authorization: [
              {
                actor: 'eosio',
                permission: 'active',
              },
            ],
            data: {
              feature_digest: feature.hash,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Фича активирована: ', feature.name)
  }

  async createToken(params: TokenContract.Interfaces.ICreate) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: 'eosio.token',
            name: TokenContract.Actions.Create.actionName,
            authorization: [
              {
                actor: 'eosio.token',
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Токен создан: ', params)
  }

  async issueToken(params: TokenContract.Interfaces.IIssue) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: 'eosio.token',
            name: TokenContract.Actions.Issue.actionName,
            authorization: [
              {
                actor: 'eosio',
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Токен выпущен: ', params)
  }

  async initSystem(params: SystemContract.Actions.Init.IInit) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: SystemContract.contractName.production,
            name: SystemContract.Actions.Init.actionName,
            authorization: [
              {
                actor: 'eosio',
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Системный контракт инициализирован', params)
  }

  async initEmission(
    params: SystemContract.Actions.InitEmission.IInitEmission,
  ) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: SystemContract.contractName.production,
            name: SystemContract.Actions.InitEmission.actionName,
            authorization: [
              {
                actor: 'eosio',
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Эмиссия инициализирована', params)
  }

  async initPowerup(params: SystemContract.Actions.InitPowerup.IInitPowerup) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: SystemContract.contractName.production,
            name: SystemContract.Actions.InitPowerup.actionName,
            authorization: [
              {
                actor: 'eosio',
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Система аренды инициализирована', params)
  }

  async powerup(params: SystemContract.Actions.Powerup.IPowerup) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: SystemContract.contractName.production,
            name: SystemContract.Actions.Powerup.actionName,
            authorization: [
              {
                actor: params.payer,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Аренда ресурсов: ', params)
  }

  async preInit(
    params: RegistratorContract.Actions.SetCoopStatus.ISetCoopStatus,
  ) {
    await this.update_pass_instance()
    console.log(params)
    await this.api.transact(
      {
        actions: [
          {
            account: RegistratorContract.contractName.production,
            name: RegistratorContract.Actions.SetCoopStatus.actionName,
            authorization: [
              {
                actor: config.provider,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Новый кооператив пре-иниализирован: ', params)
  }

  // TODO change registerCooperative to registerCooperative
  async registerCooperative(
    params: RegistratorContract.Actions.RegisterCooperative.IRegisterCooperative,
  ) {
    await this.update_pass_instance()
    console.log(params)
    await this.api.transact(
      {
        actions: [
          {
            account: RegistratorContract.contractName.production,
            name: RegistratorContract.Actions.RegisterCooperative.actionName,
            authorization: [
              {
                actor: params.coopname,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Новая организация: ', params)
  }

  async sendAgreement(
    data: SovietContract.Actions.Agreements.SendAgreement.ISendAgreement,
  ) {
    console.log('data', data)
    await this.api.transact(
      {
        actions: [
          {
            account: SovietContract.contractName.production,
            name: SovietContract.Actions.Agreements.SendAgreement.actionName,
            authorization: [
              {
                actor: data.administrator,
                permission: 'active',
              },
            ],
            data,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )
  }

  async createAccount(
    params: RegistratorContract.Actions.CreateAccount.ICreateAccount,
  ) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: RegistratorContract.contractName.production,
            name: RegistratorContract.Actions.CreateAccount.actionName,
            authorization: [
              {
                actor: params.coopname,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Новый аккаунт 2: ', params)
  }

  async registerUser(
    params: RegistratorContract.Actions.RegisterUser.IRegisterUser,
  ) {
    await this.update_pass_instance()
    console.dir(params, { depth: null })
    await this.api.transact(
      {
        actions: [
          {
            account: RegistratorContract.contractName.production,
            name: RegistratorContract.Actions.RegisterUser.actionName,
            authorization: [
              {
                actor: params.coopname,
                permission: 'active',
              },
            ],
            data: params,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Новый пользователь: ', params)
  }

  async addUser(
    params: RegistratorContract.Actions.AddUser.IAddUser,
  ) {
    await this.update_pass_instance()
    console.dir(params, { depth: null })
    await this.api.transact(
      {
        actions: [
          {
            account: RegistratorContract.contractName.production,
            name: RegistratorContract.Actions.AddUser.actionName,
            authorization: [
              {
                actor: params.coopname,
                permission: 'active',
              },
            ],
            data: params,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Добавлен пользователь: ', params.username)
  }

  async changeKey(
    params: RegistratorContract.Actions.ChangeKey.IChangeKey,
  ) {
    await this.update_pass_instance()
    console.dir(params, { depth: null })
    await this.api.transact(
      {
        actions: [
          {
            account: RegistratorContract.contractName.production,
            name: RegistratorContract.Actions.ChangeKey.actionName,
            authorization: [
              {
                actor: params.coopname,
                permission: 'active',
              },
            ],
            data: params,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Изменён ключ для пользователя: ', params.username)
  }

  async transfer(params: TokenContract.Actions.Transfer.ITransfer) {
    await this.update_pass_instance()
    console.dir(params, { depth: null })
    const result = await this.api.transact(
      {
        actions: [
          {
            account: TokenContract.contractName.production,
            name: TokenContract.Actions.Transfer.actionName,
            authorization: [
              {
                actor: params.from,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Перевод токенов: ', params)
    return result
  }

  async updateAccountPermissionsToCode(
    account_for_change: string,
    account_for_set_code: string,
  ) {
    try {
      await this.update_pass_instance()

      const result = await this.api.transact(
        {
          actions: [
            {
              account: 'eosio',
              name: 'updateauth',
              authorization: [
                {
                  actor: account_for_change,
                  permission: 'active',
                },
              ],
              data: {
                account: account_for_change,
                permission: 'active',
                parent: 'owner',
                auth: {
                  threshold: 1,
                  keys: [
                    {
                      key:
                        this.new_accounts.find(
                          (account: any) =>
                            account.username === account_for_change,
                        )?.publicKey || config.default_public_key,
                      weight: 1,
                    },
                  ],
                  accounts: [
                    {
                      permission: {
                        actor: account_for_set_code,
                        permission: 'eosio.code',
                      },
                      weight: 1,
                    },
                  ],
                  waits: [],
                },
              },
            },
          ],
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        },
      )

      console.log(
        `Updated account permissions: ${account_for_change} -> ${account_for_set_code}`,
      )
      return result
    }
    catch (e) {
      console.error(e)
    }
  }

  async votefor(
    params: SovietContract.Actions.Decisions.VoteFor.IVoteForDecision,
  ) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: SovietContract.contractName.production,
            name: SovietContract.Actions.Decisions.VoteFor.actionName,
            authorization: [
              {
                actor: params.username,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Голос за решение: ', params)
  }

  async authorize(
    params: SovietContract.Actions.Decisions.Authorize.IAuthorize,
  ) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: SovietContract.contractName.production,
            name: SovietContract.Actions.Decisions.Authorize.actionName,
            authorization: [
              {
                actor: params.chairman,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Решение утверждено: ', params)
  }

  async exec(params: SovietContract.Actions.Decisions.Exec.IExec) {
    await this.update_pass_instance()
    try {
      await this.api.transact(
        {
          actions: [
            {
              account: SovietContract.contractName.production,
              name: SovietContract.Actions.Decisions.Exec.actionName,
              authorization: [
                {
                  actor: params.executer,
                  permission: 'active',
                },
              ],
              data: {
                ...params,
              },
            },
          ],
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        },
      )
    }
    catch (e) {
      console.dir(e, { depth: null })
    }
    console.log('Решение исполнено: ', params)
  }

  async ConfirmPayment(
    params: GatewayContract.Actions.CompleteIncome.ICompleteIncome,
  ) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: GatewayContract.contractName.production,
            name: GatewayContract.Actions.CompleteIncome.actionName,
            authorization: [
              {
                actor: params.coopname,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Заявление на вступление отправлено в совет: ', params)
  }

  async createDraft(params: DraftContract.Actions.CreateDraft.ICreateDraft) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: DraftContract.contractName.production,
            name: DraftContract.Actions.CreateDraft.actionName,
            authorization: [
              {
                actor: params.username,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Шаблон создан: ', params.registry_id)
  }

  async createTranslation(
    params: DraftContract.Actions.CreateTranslation.ICreateTranslation,
  ) {
    await this.update_pass_instance()

    await this.api.transact(
      {
        actions: [
          {
            account: DraftContract.contractName.production,
            name: DraftContract.Actions.CreateTranslation.actionName,
            authorization: [
              {
                actor: 'eosio',
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Перевод создан: ', params.registry_id)
  }

  async createProgram(
    params: SovietContract.Actions.Programs.CreateProgram.ICreateProgram,
  ) {
    await this.update_pass_instance()
    console.log('params', params)
    await this.api.transact(
      {
        actions: [
          {
            account: SovietContract.contractName.production,
            name: SovietContract.Actions.Programs.CreateProgram.actionName,
            authorization: [
              {
                actor: params.username,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Программа установлена: ', params)
  }

  async createBoard(params: SovietContract.Actions.Boards.CreateBoard.ICreateboard) {
    await this.update_pass_instance()
    console.dir(params, { depth: null })
    const result = await this.api.transact(
      {
        actions: [
          {
            account: SovietContract.contractName.production,
            name: SovietContract.Actions.Boards.CreateBoard.actionName,
            authorization: [
              {
                actor: params.coopname,
                permission: 'active',
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    console.log('Создан совет: ', params)
    return result
  }

  /**
   * Выполняет транзакцию и автоматически выводит консоль логи через consoleIt
   * @param actions - массив действий для транзакции
   * @param options - опции транзакции (по умолчанию стандартные)
   * @param options.blocksBehind - количество блоков позади для подтверждения
   * @param options.expireSeconds - время жизни транзакции в секундах
   * @returns результат транзакции
   */
  async transactWithLogs(
    actions: any[],
    options: { blocksBehind?: number, expireSeconds?: number } = {},
  ): Promise<any> {
    await this.update_pass_instance()

    const defaultOptions = {
      blocksBehind: 3,
      expireSeconds: 30,
      ...options,
    }

    const result = await this.api.transact(
      { actions },
      defaultOptions,
    )

    // Автоматически выводим консоль логи
    consoleIt(result)

    return result
  }
}
