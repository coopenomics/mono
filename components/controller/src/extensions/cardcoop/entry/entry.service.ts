/**
 * Вход по карте кооператора (story 9.2, FR-F1) и быстрая регистрация (story 9.3, FR-F2/F4).
 *
 * Что карта может и чего не может — решение ant 31.08.2026. Карта **опознаёт** человека, но
 * не впускает: сессий по карте не существует, потому что вход в стол — это пароль (сейф) и
 * подпись ключом, а карта не даёт ни того, ни другого. Пайщика карта приводит к его
 * учётной записи и штатному входу; кандидата — в быструю регистрацию, где анкету за него
 * привозит кооператив-источник по согласию, удостоверенному card.coop.
 *
 * Обмен кода на токен идёт сервер-сервером с секретом клиента, выданным сетью при
 * подключении (story 7.6): в браузере не появляется ни секрет, ни токен.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CardcoopExtension } from '../cardcoop.extension';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, Repository } from 'typeorm';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  CardcoopAttestationState,
  CardcoopAttestationTypeormEntity,
} from '../infrastructure/entities/cardcoop-attestation.typeorm-entity';
import { CardcoopConnectStateTypeormEntity } from '../infrastructure/entities/cardcoop-connect-state.typeorm-entity';
import { CardcoopPendingLinkTypeormEntity } from '../infrastructure/entities/cardcoop-pending-link.typeorm-entity';
import {
  CardcoopEntryOutcome,
  CardcoopEntrySessionTypeormEntity,
  CardcoopEntryStatus,
} from '../infrastructure/entities/cardcoop-entry-session.typeorm-entity';

/** Сколько живёт начатый вход: за это время человек успевает пройти согласие на card.coop. */
const ROUND_TRIP_TTL_MS = 10 * 60 * 1000;

/** Предел одновременных начатых входов: перебор не должен раздувать память. */
const MAX_PENDING = 10_000;

/**
 * Сколько живёт сессия входа.
 *
 * Сессия может держать анкету — персональные данные, полученные ради одной регистрации.
 * Брошенная регистрация не должна оставлять их лежать: просроченные сессии стираются
 * попутно, при каждом новом входе — отдельного расписания ради этого не заводится.
 */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Сколько ждём решения держателя, прежде чем признать, что его не будет.
 *
 * Ровно столько же живёт запрос на стороне сети, поэтому дольше ждать нечего: там он уже
 * погас. Отсчёт нужен и при исправной сети — уведомление о погашении может не доехать, —
 * и это единственная защита от бесконечного ожидания у экрана (3B5-54).
 */
const CONSENT_WAIT_TTL_MS = 15 * 60 * 1000;

/** Статусы членства в claims card.coop — форма задана сетью. */
export enum EntryMembershipClaimStatus {
  Active = 'active',
  Revoked = 'revoked',
}

/** Членство из claims card.coop. */
export interface EntryMembershipClaim {
  coop?: string;
  coopname?: string;
  status?: EntryMembershipClaimStatus;
  member_since?: string;
}

/** Что вернулось из обмена кода: разобранные claims id_token. */
interface EntryClaims {
  sub: string;
  card_number: string | null;
  memberships: EntryMembershipClaim[];
}

/** Начатый вход: ждёт возврата браузера с кодом. */
interface PendingRoundTrip {
  verifier: string;
  createdAt: number;
}

@Injectable()
export class CardcoopEntryService {
  /** Начатые входы: state → PKCE-verifier. В памяти намеренно — жизнь короче любого рестарта. */
  private readonly pending = new Map<string, PendingRoundTrip>();

  constructor(
    @InjectRepository(CardcoopConnectStateTypeormEntity)
    private readonly connectState: Repository<CardcoopConnectStateTypeormEntity>,
    @InjectRepository(CardcoopAttestationTypeormEntity)
    private readonly attestations: Repository<CardcoopAttestationTypeormEntity>,
    @InjectRepository(CardcoopEntrySessionTypeormEntity)
    private readonly sessions: Repository<CardcoopEntrySessionTypeormEntity>,
    @InjectRepository(CardcoopPendingLinkTypeormEntity)
    private readonly pendingLinks: Repository<CardcoopPendingLinkTypeormEntity>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly extension: CardcoopExtension
  ) {
    this.logger.setContext(CardcoopEntryService.name);
  }

  /**
   * Доступен ли вход по карте: включён в настройках и сеть выдала реквизиты клиента при подключении.
   *
   * @returns `true`, если кнопке входа есть куда вести.
   */
  async available(): Promise<boolean> {
    // Председатель может убрать кнопку настройкой, даже когда реквизиты от сети есть.
    if (this.extension.config.entry_enabled === false) return false;
    const state = await this.connectState.findOne({ where: { id: 'self' } });
    return Boolean(state?.rpClientId && state.rpClientSecret && state.rpIssuer);
  }

  /**
   * Начинает вход: возвращает адрес авторизации card.coop.
   *
   * @param apiUrl — адрес сети из конфигурации расширения.
   * @returns Адрес, куда уводится браузер.
   * @throws NotFoundException Если вход по карте не подключён.
   */
  async start(apiUrl: string): Promise<string> {
    const creds = await this.requireCreds();
    await this.dropExpiredSessions();

    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    this.remember(state, verifier);

    const challenge = createHash('sha256').update(verifier, 'utf8').digest('base64url');
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: creds.clientId,
      redirect_uri: this.callbackUrl(),
      scope: 'openid profile email cardcoop:card cardcoop:memberships',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    return `${apiUrl.replace(/\/+$/, '')}/application/o/authorize/?${query.toString()}`;
  }

  /**
   * Принимает возврат из card.coop: меняет код на токен и решает, пайщик это или кандидат.
   *
   * @param apiUrl — адрес сети.
   * @param state — противоподделочный ключ начатого входа.
   * @param code — код авторизации.
   * @returns Сессия входа — браузер уводится на её страницу.
   * @throws NotFoundException Если вход не начинался, протух либо обмен не удался.
   */
  async callback(apiUrl: string, state: string, code: string): Promise<CardcoopEntrySessionTypeormEntity> {
    const trip = this.pending.get(state);
    this.pending.delete(state);
    if (!trip || Date.now() - trip.createdAt > ROUND_TRIP_TTL_MS) {
      throw new NotFoundException('Вход не начинался либо истёк — начните заново');
    }

    const claims = await this.exchange(apiUrl, code, trip.verifier);

    const known = await this.identify(claims.sub);

    const session = this.sessions.create({
      id: randomUUID(),
      cardId: claims.sub,
      cardNumber: claims.card_number,
      outcome: known?.member ? CardcoopEntryOutcome.Member : CardcoopEntryOutcome.Candidate,
      username: known?.username ?? null,
      // Членства нужны только тому, кого мы не знаем: у человека с учётной записью анкета
      // уже наша, и предлагать ему перенос значит звать вступать во второй раз.
      memberships: known ? [] : this.foreignMemberships(claims.memberships),
      status: CardcoopEntryStatus.Started,
    });

    return this.sessions.save(session);
  }

  /**
   * Узнаём ли мы человека по его карте (3B5-53).
   *
   * Опознание идёт по НАШИМ записям: чужим claims о нашем членстве мы не доверяем и не
   * пользуемся. Записей две, и обе означают «учётная запись у него уже есть»:
   *
   * - свидетельство членства в журнале — кроме отозванного: отозванное значит, что человек
   *   вышел, и вступать ему действительно заново. Недоставленное и отвергнутое сетью
   *   свидетельство членством быть не перестаёт: это состояние доставки документа, а не
   *   состояние человека, и считать пайщика кандидатом из-за моргнувшей сети нельзя;
   * - ожидающая связка кандидата, который принёс карту на вступлении (story 7.5): совет ещё
   *   не решил, но учётная запись заведена, и второй ей не место.
   *
   * Кого не узнали — тому и предлагается быстрая регистрация. Опознавать по совпадению
   * почты нельзя ни при каких обстоятельствах (FR-A2в): это способ присвоить чужое членство.
   *
   * @param cardId — карта из токена сети.
   * @returns Учётная запись и признак действующего членства; `null` — человек нам неизвестен.
   */
  private async identify(cardId: string): Promise<{ username: string; member: boolean } | null> {
    const attestation = await this.attestations.findOne({
      where: { cardId, state: Not(CardcoopAttestationState.Revoked) },
    });
    if (attestation) return { username: attestation.username, member: true };

    const pending = await this.pendingLinks.findOne({ where: { cardId } });
    if (pending) return { username: pending.username, member: false };

    return null;
  }

  /**
   * Членства в других кооперативах — кандидату из них выбирать источник анкеты.
   *
   * Свой кооператив из перечня исключается: раскрытие самому себе не существует, и предлагать
   * его значило бы вести человека в отказ.
   */
  private foreignMemberships(claims: EntryMembershipClaim[]): Array<Record<string, unknown>> {
    return claims
      .filter((entry) => entry.coopname && entry.coopname !== platformSettings().coopname)
      .filter((entry) => entry.status === EntryMembershipClaimStatus.Active)
      .map((entry) => ({
        coopname: entry.coopname as string,
        display_name: entry.coop ?? (entry.coopname as string),
        member_since: entry.member_since ?? null,
      }));
  }

  /**
   * Меняет код на токен и разбирает claims.
   *
   * Подпись id_token не перепроверяется намеренно: токен получен прямым TLS-обменом у самого
   * издателя, и подменить его в этом канале некому. Проверяются утверждения: издатель,
   * адресат и срок — токен, выданный другим клиентом или в прошлом месяце, не проходит.
   */
  private async exchange(apiUrl: string, code: string, verifier: string): Promise<EntryClaims> {
    const creds = await this.requireCreds();

    const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/application/o/token/`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.callbackUrl(),
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code_verifier: verifier,
      }).toString(),
    });

    if (!response.ok) {
      this.logger.error(`Обмен кода входа по карте не удался: сеть ответила ${response.status}`);
      throw new NotFoundException('Вход не подтверждён сетью — начните заново');
    }

    const tokens = (await response.json()) as { id_token?: string };
    return this.acceptClaims(decodeIdToken(tokens.id_token ?? ''), creds);
  }

  /**
   * Принимает утверждения токена: издатель, адресат и срок обязаны сойтись.
   *
   * @param claims — разобранные утверждения; `null` — токен не разбирается.
   * @param creds — наши реквизиты клиента.
   */
  private acceptClaims(
    claims: Record<string, unknown> | null,
    creds: { clientId: string; issuer: string }
  ): EntryClaims {
    if (!claims || claims.iss !== creds.issuer || claims.aud !== creds.clientId) {
      throw new NotFoundException('Токен сети не разбирается либо адресован не нам');
    }
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
      throw new NotFoundException('Токен сети просрочен — начните заново');
    }

    return {
      sub: String(claims.sub ?? ''),
      card_number: typeof claims.card_number === 'string' ? claims.card_number : null,
      memberships: Array.isArray(claims.memberships) ? (claims.memberships as EntryMembershipClaim[]) : [],
    };
  }

  /**
   * Сессия входа по идентификатору.
   *
   * @param id — идентификатор из адреса возврата.
   * @returns Сессия.
   * @throws NotFoundException Если сессии нет либо она истекла.
   */
  async session(id: string): Promise<CardcoopEntrySessionTypeormEntity> {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Сессия входа не найдена — начните заново');

    if (Date.now() - session.createdAt.getTime() > SESSION_TTL_MS) {
      // Срок сессии проверяется при чтении, а не только при чистке: чистка идёт на новом
      // входе, а его может не быть сутками, и просроченная сессия отвечала бы как живая.
      throw new NotFoundException('Сессия входа истекла — начните заново');
    }

    // Ожидание решения держателя не бесконечно. На стороне сети запрос к этому моменту уже
    // погас, и уведомление об этом могло не доехать; без собственного отсчёта человек
    // остался бы у страницы, которая опрашивает сервер до закрытия вкладки (3B5-54).
    if (
      session.status === CardcoopEntryStatus.AwaitingConsent &&
      Date.now() - session.updatedAt.getTime() > CONSENT_WAIT_TTL_MS
    ) {
      session.status = CardcoopEntryStatus.Expired;
      return this.sessions.save(session);
    }

    return session;
  }

  /**
   * Отдаёт анкету ровно один раз и стирает её.
   *
   * Единственное прочтение — сознательная защита: ссылка на сессию остаётся в истории
   * браузера, и повторное открытие не должно отдавать персональные данные.
   *
   * @param id — сессия входа.
   * @returns Вид субъекта и анкета.
   * @throws NotFoundException Если анкеты нет либо её уже забрали.
   */
  async takeProfile(id: string): Promise<{ subjectType: string; profile: Record<string, unknown> }> {
    const session = await this.session(id);
    if (!session.profile || !session.profileType || session.profileTakenAt) {
      throw new NotFoundException('Анкета недоступна: её нет либо она уже забрана в форму');
    }

    const result = { subjectType: session.profileType, profile: session.profile };
    session.profile = null;
    session.profileTakenAt = new Date();
    await this.sessions.save(session);

    return result;
  }

  /** Реквизиты клиента; их отсутствие — вход по карте не подключён. */
  private async requireCreds(): Promise<{ clientId: string; clientSecret: string; issuer: string }> {
    const state = await this.connectState.findOne({ where: { id: 'self' } });
    if (!state?.rpClientId || !state.rpClientSecret || !state.rpIssuer) {
      throw new NotFoundException('Вход по карте не подключён у этого кооператива');
    }
    return { clientId: state.rpClientId, clientSecret: state.rpClientSecret, issuer: state.rpIssuer };
  }

  /** Стирает просроченные сессии — вместе с анкетами, которые в них могли остаться. */
  private async dropExpiredSessions(): Promise<void> {
    try {
      await this.sessions.delete({ createdAt: LessThan(new Date(Date.now() - SESSION_TTL_MS)) });
    } catch (error) {
      this.logger.warn(
        `Просроченные сессии входа не вычищены: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Адрес возврата — тот же, что заявлен сети при подключении. */
  private callbackUrl(): string {
    return `${platformSettings().backendUrl.replace(/\/+$/, '')}/v1/extensions/cardcoop/entry/callback`;
  }

  /** Запоминает начатый вход, не давая карте начатых входов расти без предела. */
  private remember(state: string, verifier: string): void {
    if (this.pending.size >= MAX_PENDING) {
      const now = Date.now();
      for (const [key, trip] of this.pending) {
        if (now - trip.createdAt > ROUND_TRIP_TTL_MS) this.pending.delete(key);
      }
    }
    this.pending.set(state, { verifier, createdAt: Date.now() });
  }
}

/** Разбирает утверждения id_token без проверки подписи (см. `exchange`). */
function decodeIdToken(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(parts[1] as string, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}
