import type { ClientConnectionOptions } from './types/client'
import { Bytes, Checksum256, PrivateKey } from '@wharfkit/session'
import WebSocket from 'isomorphic-ws'

import * as Classes from './classes'
import * as Mutations from './mutations'
import { wsSubscription } from './utils/wsSubscription'
import { type GraphQLResponse, Thunder } from './zeus/index'

import { ZeusScalars } from './zeus/index'

export * as Classes from './classes'
export * as Mutations from './mutations'
export * as Queries from './queries'
export * as Selectors from './selectors'
export * as Subscriptions from './subscriptions'

export * as Types from './types'

export * as Zeus from './zeus/index'

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as any
}

export class Client {
  private currentHeaders: Record<string, string> = {}
  private account: Classes.Account
  private blockchain: Classes.Blockchain
  private document: Classes.Document
  private crypto: Classes.Crypto
  private vote: Classes.Vote
  private thunder: ReturnType<typeof Thunder>
  private static scalars = ZeusScalars({
    DateTime: {
      decode: (e: unknown) => new Date(e as string), // Преобразует строку в объект Date
      encode: (e: unknown) => (e as Date).toISOString(), // Преобразует Date в ISO-строку
    },
  })

  public constructor(private readonly options: ClientConnectionOptions) {
    this.currentHeaders = options.headers || {}
    this.thunder = this.createThunder(options.api_url)
    this.account = new Classes.Account()
    this.blockchain = new Classes.Blockchain(options)
    this.document = new Classes.Document(options.wif)
    this.crypto = new Classes.Crypto()
    this.vote = new Classes.Vote(options.wif)

    if (options.wif && options.username) {
      this.blockchain.setWif(options.username, options.wif)
      this.document.setWif(options.wif)
      this.vote.setWif(options.wif)
    }
    else if ((options.wif && !options.username) || (!options.wif && options.username)) {
      throw new Error('wif и username должны быть указаны одновременно')
    }
  }

  /**
   * Создает экземпляр клиента с заданными опциями (для обратной совместимости).
   * @param options Параметры соединения.
   */
  public static create(options: ClientConnectionOptions): Client {
    return new Client(options)
  }

  /**
   * Создает новый экземпляр клиента.
   * @param options Параметры соединения.
   */
  public static New(options: ClientConnectionOptions): Client {
    return new Client(options)
  }

  /**
   * Логин пользователя с использованием email и WIF.
   * @param email Email пользователя.
   * @param wif Приватный ключ в формате WIF.
   * @returns Результат логина.
   */
  public async login(email: string, wif: string): Promise<Mutations.Auth.Login.IOutput['login']> {
    const now = (await this.blockchain.getInfo()).head_block_time.toString()

    const privateKey = PrivateKey.fromString(wif)
    const bytes = Bytes.fromString(now, 'utf8')
    const checksum = Checksum256.hash(bytes)
    const signature = privateKey.signDigest(checksum).toString()

    const variables: Mutations.Auth.Login.IInput = {
      data: {
        email,
        now,
        signature,
      },
    }

    const { [Mutations.Auth.Login.name]: result } = await this.thunder('mutation')(
      Mutations.Auth.Login.mutation,
      {
        variables,
      },
    )

    // Устанавливаем WIF в Blockchain и Document
    const username = result.account.username

    this.blockchain.setWif(username, wif)
    this.document.setWif(wif)
    this.vote.setWif(wif)
    this.currentHeaders.Authorization = `Bearer ${result.tokens.access.token}`

    return result
  }

  /**
   * Установка токена авторизации.
   * @param token Токен для заголовков Authorization.
   */
  public setToken(token: string): void {
    this.currentHeaders.Authorization = `Bearer ${token}`
  }

  /**
   * Установка WIF.
   * @param username Имя пользователя.
   * @param wif WIF для установки.
   */
  public setWif(username: string, wif: string): void {
    this.blockchain.setWif(username, wif)
    this.document.setWif(wif)
    this.vote.setWif(wif)
  }

  /**
   * Доступ к Blockchain.
   */
  public get Blockchain(): Classes.Blockchain {
    return this.blockchain
  }

  /**
   * Доступ к Account.
   */
  public get Account(): Classes.Account {
    return this.account
  }

  /**
   * Доступ к Document.
   */
  public get Document(): Classes.Document {
    return this.document
  }

  /**
   * Доступ к Crypto.
   */
  public get Crypto(): Classes.Crypto {
    return this.crypto
  }

  /**
   * Доступ к Vote.
   */
  public get Vote(): Classes.Vote {
    return this.vote
  }

  /**
   * Доступ к GraphQL-запросам.
   */
  public get Query() {
    return this.thunder('query') // Сохраняет строгую типизацию Zeus
  }

  /**
   * Доступ к GraphQL-мутациям.
   */
  public get Mutation() {
    return this.thunder('mutation') // Сохраняет строгую типизацию Zeus
  }

  /**
   * Подписка на GraphQL-события.
   */
  public get Subscription() {
    // Прокидываем заголовки (в т.ч. Authorization) — транспорт кладёт их в
    // connectionParams ws-соединения, по которым сервер аутентифицирует
    // подписку в onConnect. Без этого канал был бы анонимным и отклонялся.
    // Не сгенерированный Zeus-Subscription: тот теряет variables (см.
    // utils/wsSubscription.ts), а правки генерята стирает регенерация.
    return wsSubscription(this.options.api_url.replace(/^http/, 'ws'), {
      headers: this.currentHeaders,
    })
  }

  /**
   * Создает функцию Thunder для выполнения GraphQL-запросов.
   * @param baseUrl URL GraphQL API.
   * @returns Функция Thunder.
   */
  private createThunder(baseUrl: string) {
    return Thunder(async (query, variables) => {
      const response = await fetch(baseUrl, {
        body: JSON.stringify({ query, variables }),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.currentHeaders,
        },
      })

      if (!response.ok) {
        return new Promise((resolve, reject) => {
          response
            .text()
            .then((text) => {
              try {
                reject(JSON.parse(text))
              }
              catch {
                reject(text)
              }
            })
            .catch(reject)
        })
      }

      const json = (await response.json()) as GraphQLResponse

      if (json.errors) {
        throw json.errors
      }

      return json.data
    }, { scalars: Client.scalars })
  }
}
