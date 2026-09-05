import type { ClientConnectionOptions } from './types/client'
import { Bytes, Checksum256, PrivateKey } from '@wharfkit/session'
import WebSocket from 'isomorphic-ws'

import * as Classes from './classes'
import * as Mutations from './mutations'
import { wsSubscription, type WsSubscriptionApi } from './utils/wsSubscription'
import { type GraphQLResponse, Thunder, ZeusScalars } from './zeus/index'

/** Таймаут HTTP GraphQL — без него при мёртвом бэкенде fetch висит и копит запросы. */
const HTTP_TIMEOUT_MS = 30_000

/**
 * Ошибка провайдера access-токена, после которой запрос отправлять нельзя
 * (см. `Client.prepareAuthorization`). Провайдер выставляет `abortRequest`, SDK
 * пробрасывает такую ошибку вызывающему коду вместо отправки запроса со старым
 * заголовком.
 */
export interface AccessTokenUnavailableError extends Error {
  abortRequest: true
}

function isAbortRequestError(error: unknown): error is AccessTokenUnavailableError {
  return typeof error === 'object' && error !== null
    && (error as { abortRequest?: unknown }).abortRequest === true
}

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

/**
 * Адрес GraphQL → адрес вебсокета.
 *
 * `api_url` может быть относительным (`/backend/v1/graphql`) — так фронт и бэкенд
 * живут на одном адресе за общим прокси, и запрос не зависит от того, открыт стенд
 * по localhost, по IP или по домену. Простая замена схемы на относительном пути
 * ничего не делает, а конструктор WebSocket с относительным адресом ведёт себя
 * по-разному в разных браузерах. Поэтому достраиваем адрес до абсолютного от
 * origin страницы и только потом меняем схему.
 */
function toWebSocketUrl(apiUrl: string): string {
  const absolute
    = /^https?:\/\//.test(apiUrl)
      ? apiUrl
      : typeof window !== 'undefined' && window.location
        ? new URL(apiUrl, window.location.origin).toString()
        : apiUrl
  return absolute.replace(/^http/, 'ws')
}

export class Client {
  private currentHeaders: Record<string, string> = {}
  private accessTokenProvider?: () => Promise<string>
  private account: Classes.Account
  private blockchain: Classes.Blockchain
  private document: Classes.Document
  private crypto: Classes.Crypto
  private vote: Classes.Vote
  private thunder: ReturnType<typeof Thunder>
  /** Shared graphql-ws транспорт — не создавать на каждый доступ к getter. */
  private subscriptionApi: WsSubscriptionApi | null = null
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
   * Привязывает источник access-токена контура CoopID (`@coopenomics/auth.getAccessToken`):
   * перед каждым GraphQL-запросом SDK берёт свежий токен (с авто-refresh) и кладёт его в
   * заголовок Authorization. Так bearer остаётся внутри слоя SDK (D1, Эпик 7), а приложение
   * не передаёт токен вручную. Передать `undefined` — отвязать (вернуться к setToken/login).
   *
   * Развязка по зависимостям умышленная: SDK НЕ импортирует `@coopenomics/auth` (тот тянет
   * браузерный oidc-client-ts и сломал бы Node-потребителей SDK) — принимает лишь функцию.
   */
  public setAccessTokenProvider(provider?: () => Promise<string>): void {
    this.accessTokenProvider = provider
  }

  /**
   * Готовит заголовок Authorization к запросу.
   *
   * Провайдер токена может отказать по двум разным причинам, и SDK их различает:
   * - нет активной CoopID-сессии — запрос уходит с тем, что уже есть в заголовках
   *   (legacy-токен из setToken/login, если был), итоговую авторизацию решает сервер;
   * - токен есть, но обновить его нельзя (сеть) — провайдер помечает ошибку
   *   `abortRequest`, и запрос не отправляется вовсе. Со старым заголовком он бы
   *   не упал, а получил бы ответ как для гостя: бэкенд на негодный токен молча
   *   понижает права, и клиент принимал бы гостевой ответ за свой.
   * @returns true — запрос уйдёт от имени пользователя, false — гостем.
   */
  private async prepareAuthorization(): Promise<boolean> {
    if (this.accessTokenProvider) {
      try {
        this.currentHeaders.Authorization = `Bearer ${await this.accessTokenProvider()}`
        return true
      }
      catch (error) {
        if (isAbortRequestError(error))
          throw error
      }
    }
    return Boolean(this.currentHeaders.Authorization)
  }

  /**
   * Проверяет без запроса, что следующий запрос уйдёт от имени пользователя.
   * Нужен там, где гостевой ответ неотличим от отказа (рабочий стол с грантами):
   * вызывающий код помечает результат именем пользователя только при `true`.
   * @throws как перед запросом — ошибка провайдера с `abortRequest`.
   */
  public async ensureAccessToken(): Promise<boolean> {
    return this.prepareAuthorization()
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
   * Синглтон на экземпляр Client: повторный доступ к getter НЕ плодит
   * graphql-ws клиентов (иначе при обрыве каждый orphan долбит реконнект).
   */
  public get Subscription() {
    if (!this.subscriptionApi) {
      // headers как getter — Authorization актуален на каждом (ре)коннекте.
      // Не сгенерированный Zeus-Subscription: тот теряет variables (см.
      // utils/wsSubscription.ts), а правки генерята стирает регенерация.
      this.subscriptionApi = wsSubscription(toWebSocketUrl(this.options.api_url), {
        headers: () => this.currentHeaders,
      })
    }
    return this.subscriptionApi
  }

  /**
   * Полностью гасит shared ws-транспорт (logout / teardown).
   * Обычное закрытие одной подписки — через `stream.ws.close()` (unsubscribe).
   */
  public disposeSubscriptions(): void {
    this.subscriptionApi?.dispose()
    this.subscriptionApi = null
  }

  /**
   * Создает функцию Thunder для выполнения GraphQL-запросов.
   * @param baseUrl URL GraphQL API.
   * @returns Функция Thunder.
   */
  private createThunder(baseUrl: string) {
    return Thunder(async (query, variables) => {
      await this.prepareAuthorization()
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
        : null

      try {
        const response = await fetch(baseUrl, {
          body: JSON.stringify({ query, variables }),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.currentHeaders,
          },
          signal: controller?.signal,
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
      }
      finally {
        if (timeoutId)
          clearTimeout(timeoutId)
      }
    }, { scalars: Client.scalars })
  }
}
