/**
 * Помощники платформенных тестов: подписки GraphQL по веб-сокету, вход без
 * общего кеша токенов и паевой взнос в цепи с номерами блоков.
 *
 * Подписки идут по протоколу graphql-transport-ws (библиотека graphql-ws на
 * сервере) тем же путём, что HTTP (`/v1/graphql`). Клиент здесь свой, на
 * встроенном в Node 22 WebSocket: пакет graphql-ws в зависимостях api-tests не
 * объявлен, а протокол короткий — connection_init → connection_ack, subscribe →
 * next/error/complete, ping → pong. Отказ в опознании сервер даёт закрытием
 * сокета с кодом 4403.
 */
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import type { Who } from '../core/auth'
import { transact } from '../core/chain'
import type { GqlError } from '../core/client'
import { gql } from '../core/client'
import { API_URL, CHAIN_URL, COOP } from '../core/env'
import { COOP_SIGNER, rub } from '../core/wallet'

export const WS_URL = API_URL.replace(/^http/, 'ws')

/** Код закрытия, которым graphql-ws отвечает на отказ в onConnect. */
export const WS_FORBIDDEN = 4403

/** Соединение закрыто сервером до подтверждения — отказ в опознании. */
export class WsRejected extends Error {
  constructor(readonly code: number, readonly reason: string) {
    super(`ws: соединение закрыто сервером (${code} ${reason})`)
  }
}

interface Frame { type: string, id?: string, payload?: any }

/** Одна операция подписки: копит сигналы, ошибку и завершение. */
export class WsSub {
  /** `data` каждого пришедшего сигнала — по порядку прихода. */
  readonly events: any[] = []
  /** Время прихода каждого сигнала (мс эпохи) — параллельно `events`. */
  readonly times: number[] = []
  errors: GqlError[] | null = null
  completed = false
  private readonly listeners = new Set<() => void>()

  constructor(readonly id: string, private readonly conn: WsConn) {}

  /** @internal */
  push(frame: Frame): void {
    if (frame.type === 'next') {
      const p = frame.payload ?? {}
      if (p.errors?.length)
        this.errors = normalizeErrors(p.errors)
      if (p.data) {
        this.events.push(p.data)
        this.times.push(Date.now())
      }
    }
    else if (frame.type === 'error') {
      this.errors = normalizeErrors(frame.payload)
      this.completed = true
    }
    else if (frame.type === 'complete') {
      this.completed = true
    }
    for (const l of this.listeners) l()
  }

  /** @internal — сокет закрылся: операция мертва. */
  closed(): void {
    this.completed = true
    for (const l of this.listeners) l()
  }

  /**
   * Первый сигнал (среди уже пришедших и будущих), для которого `pick` вернёт
   * значение. Ошибка операции или её завершение — исключение сразу.
   */
  async waitFor<T>(pick: (data: any) => T | null | undefined | false, timeoutMs = 60_000, label = 'сигнала'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const check = (): boolean => {
        for (const e of this.events) {
          const v = pick(e)
          if (v !== null && v !== undefined && v !== false) {
            done()
            resolve(v as T)
            return true
          }
        }
        if (this.errors) {
          done()
          reject(new Error(`подписка ${this.id} упала в ожидании ${label}: ${JSON.stringify(this.errors)}`))
          return true
        }
        if (this.completed) {
          done()
          reject(new Error(`подписка ${this.id} завершилась в ожидании ${label}`))
          return true
        }
        return false
      }
      const timer = setTimeout(() => {
        done()
        reject(new Error(`не дождались ${label} за ${timeoutMs} мс; пришло: ${JSON.stringify(this.events).slice(0, 1500)}`))
      }, timeoutMs)
      const listener = (): void => { check() }
      const done = (): void => {
        clearTimeout(timer)
        this.listeners.delete(listener)
      }
      if (!check())
        this.listeners.add(listener)
    })
  }

  /** Ошибка операции (отказ резолвера подписки). */
  async failure(timeoutMs = 30_000): Promise<GqlError> {
    return new Promise<GqlError>((resolve, reject) => {
      const check = (): boolean => {
        if (this.errors) {
          done()
          resolve(this.errors[0])
          return true
        }
        if (this.completed) {
          done()
          reject(new Error(`подписка ${this.id} завершилась без ошибки; сигналы: ${JSON.stringify(this.events).slice(0, 500)}`))
          return true
        }
        return false
      }
      const timer = setTimeout(() => {
        done()
        reject(new Error(`подписка ${this.id} не отказала за ${timeoutMs} мс`))
      }, timeoutMs)
      const listener = (): void => { check() }
      const done = (): void => {
        clearTimeout(timer)
        this.listeners.delete(listener)
      }
      if (!check())
        this.listeners.add(listener)
    })
  }

  /** Сигналы, пришедшие не раньше момента `since`. */
  since(since: number): any[] {
    return this.events.filter((_, i) => this.times[i] >= since)
  }

  stop(): void {
    this.conn.send({ id: this.id, type: 'complete' })
    this.completed = true
  }
}

function normalizeErrors(raw: any): GqlError[] {
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((e: any) => ({
    message: String(e?.message ?? ''),
    code: e?.extensions?.code != null ? String(e.extensions.code) : null,
    path: e?.path ?? null,
  }))
}

/** Соединение graphql-transport-ws после подтверждения сервером. */
export class WsConn {
  private seq = 0
  private readonly subs = new Map<string, WsSub>()
  closedWith: { code: number, reason: string } | null = null

  constructor(private readonly ws: WebSocket) {}

  /** @internal */
  send(frame: Frame): void {
    if (this.ws.readyState === this.ws.OPEN)
      this.ws.send(JSON.stringify(frame))
  }

  /** @internal */
  dispatch(frame: Frame): void {
    if (frame.type === 'ping') {
      this.send({ type: 'pong' })
      return
    }
    if (frame.id && this.subs.has(frame.id))
      this.subs.get(frame.id)!.push(frame)
  }

  /** @internal */
  onClose(code: number, reason: string): void {
    this.closedWith = { code, reason }
    for (const s of this.subs.values()) s.closed()
  }

  subscribe(query: string, variables?: Record<string, unknown>): WsSub {
    const id = String(++this.seq)
    const sub = new WsSub(id, this)
    this.subs.set(id, sub)
    this.send({ id, type: 'subscribe', payload: { query, variables } })
    return sub
  }

  close(): void {
    try {
      this.ws.close(1000, 'normal')
    }
    catch {}
  }
}

/**
 * Открыть соединение и пройти опознание. `authorization` — значение параметра
 * соединения как есть (с «Bearer » или без); `null` — без параметра вовсе.
 * Отказ сервера — WsRejected с кодом закрытия.
 */
export async function wsConnect(authorization: string | null, timeoutMs = 20_000): Promise<WsConn> {
  const ws = new WebSocket(WS_URL, 'graphql-transport-ws')
  const conn = new WsConn(ws)
  return new Promise<WsConn>((resolve, reject) => {
    let acked = false
    const timer = setTimeout(() => {
      reject(new Error(`ws: нет connection_ack за ${timeoutMs} мс`))
      conn.close()
    }, timeoutMs)
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'connection_init', payload: authorization === null ? {} : { authorization } }))
    })
    ws.addEventListener('message', (ev: MessageEvent) => {
      let frame: Frame
      try {
        frame = JSON.parse(String(ev.data))
      }
      catch {
        return
      }
      if (frame.type === 'connection_ack') {
        acked = true
        clearTimeout(timer)
        resolve(conn)
        return
      }
      conn.dispatch(frame)
    })
    ws.addEventListener('close', (ev: CloseEvent) => {
      clearTimeout(timer)
      conn.onClose(ev.code, ev.reason)
      if (!acked)
        reject(new WsRejected(ev.code, ev.reason))
    })
    // Ошибку сокета всегда сопровождает close — исход решает он.
    ws.addEventListener('error', () => {})
  })
}

/** Соединение с Bearer-токеном участника. */
export async function wsAs(token: string): Promise<WsConn> {
  return wsConnect(`Bearer ${token}`)
}

/** Код закрытия при опознании; null — соединение принято (и сразу закрыто). */
export async function wsRejectionCode(authorization: string | null): Promise<number | null> {
  try {
    const conn = await wsConnect(authorization)
    conn.close()
    return null
  }
  catch (e) {
    if (e instanceof WsRejected)
      return e.code
    throw e
  }
}

/**
 * Пауза, пока сервер разберёт `subscribe` и подпишет операцию на топики шины.
 * Подтверждения подписки в протоколе нет, а сигнал, опубликованный раньше, до
 * операции не дойдёт.
 */
export async function settleSubscriptions(ms = 2_000): Promise<void> {
  // timing: backoff — в graphql-transport-ws нет подтверждения subscribe; ждём, пока сервер подпишет операцию на шину
  await new Promise(r => setTimeout(r, ms))
}

/**
 * Окно отрицательного наблюдения: сигналы одного публикования расходятся по
 * всем каналам разом, поэтому, дождавшись положительных, ждём ещё немного и
 * проверяем, что лишних не пришло.
 */
export async function quietWindow(ms = 3_000): Promise<void> {
  // timing: backoff — отрицательная проверка: даём лишнему сигналу время дойти, если бы он был
  await new Promise(r => setTimeout(r, ms))
}

// ── Лента изменений ─────────────────────────────────────────────────────────

export const CHAIN_CHANGES = `subscription($i: ChainChangesInput!){
  chainChanges(input: $i){ code table scope primary_key block_num }
}`

export interface ChainChangeSignal {
  code: string
  table: string
  scope: string
  primary_key: string
  block_num: number
}

export function chainChangesOf(conn: WsConn, tables?: { code: string, table: string }[], coopname = COOP): WsSub {
  return conn.subscribe(CHAIN_CHANGES, { i: tables ? { coopname, tables } : { coopname } })
}

/** Сигналы ленты подписки, при желании — одной таблицы и блока. */
export function signalsOf(sub: WsSub, filter: Partial<ChainChangeSignal> = {}): ChainChangeSignal[] {
  return sub.events
    .map(e => e.chainChanges as ChainChangeSignal)
    .filter(s => !!s && Object.entries(filter).every(([k, v]) => (s as any)[k] === v))
}

/** Дождаться сигнала ленты по таблице (и блоку, если задан). */
export async function waitSignal(sub: WsSub, filter: Partial<ChainChangeSignal>, timeoutMs = 60_000): Promise<ChainChangeSignal> {
  return sub.waitFor<ChainChangeSignal>((e) => {
    const s = e?.chainChanges as ChainChangeSignal | undefined
    return s && Object.entries(filter).every(([k, v]) => (s as any)[k] === v) ? s : null
  }, timeoutMs, `сигнала ленты ${JSON.stringify(filter)}`)
}

// ── Вход без общего кеша ─────────────────────────────────────────────────────

export interface Session { access: string, refresh: string }

/**
 * Новая сессия участника: вход подписью, как в core/auth, но токены не
 * кладутся в общий кеш прогона — тест может завершить эту сессию, не ломая
 * `tokenOf` остальным файлам.
 */
export async function loginSession(who: Who): Promise<Session> {
  const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const now = info.head_block_time as string
  const signature = ecc.signHash(ecc.sha256(Buffer.from(now, 'utf8'), 'hex'), who.wif)
  const d = await gql<any>(
    null,
    'mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } refresh{ token } } } }',
    { d: { email: who.email, now, signature } },
  )
  return { access: d.login.tokens.access.token, refresh: d.login.tokens.refresh.token }
}

/** Завершить сессию выходом (оба токена). */
export async function logout(session: Session): Promise<void> {
  await gql(null, 'mutation($d:LogoutInput!){ logout(data:$d) }', {
    d: { access_token: session.access, refresh_token: session.refresh },
  })
}

/** Тот же токен с тем же содержимым, но подписанный чужим секретом. */
export function resignJwt(token: string, secret = 'not-the-node-secret'): string {
  const [header, payload] = token.split('.')
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

// ── Паевой взнос в цепи ──────────────────────────────────────────────────────

export interface ChainDeposit {
  hash: string
  /** Блок заявки на взнос: создаётся приход шлюза (gateway::incomes). */
  createBlock: number
  /** Блок исполнения: приход снят, паевой кошелёк пополнен (ledger2). */
  completeBlock: number
}

/**
 * Паевой взнос мимо контроллера — как платёжный провайдер: заявка
 * `wallet::createdpst` (приход шлюза создаётся инлайном) и исполнение
 * `gateway::incomplete`. Две транзакции — два блока, их номера и нужны
 * тестам ленты.
 */
export async function chainDeposit(username: string, sum: number): Promise<ChainDeposit> {
  const hash = crypto.randomBytes(32).toString('hex')
  const created = await transact(COOP_SIGNER, [{
    account: 'wallet',
    name: 'createdpst',
    data: { coopname: COOP, username, deposit_hash: hash, quantity: rub(sum) },
  }])
  const completed = await transact(COOP_SIGNER, [{
    account: 'gateway',
    name: 'incomplete',
    data: { coopname: COOP, income_hash: hash },
  }])
  return {
    hash,
    createBlock: Number(created.processed.block_num),
    completeBlock: Number(completed.processed.block_num),
  }
}

/** Доступный остаток кошелька пайщика по зеркалу узла (API). */
export async function mirroredAvailable(token: string, username: string, walletName = 'w.wal.share'): Promise<number> {
  const d = await gql<any>(token, 'query($u:String!){ getUserWallets(username:$u){ wallet_name available } }', { u: username })
  const row = (d.getUserWallets as any[]).find(w => w.wallet_name === walletName)
  return Number.parseFloat(String(row?.available ?? '0').split(' ')[0])
}

/** Поля объектного типа схемы — для проверок «сигнал без данных». */
export async function typeFields(token: string | null, typeName: string): Promise<string[]> {
  const d = await gql<any>(token, 'query($n:String!){ __type(name:$n){ fields{ name } } }', { n: typeName })
  return ((d.__type?.fields ?? []) as any[]).map(f => f.name).sort()
}
