/**
 * Выпуск и отправка подтверждений членства в сеть «Карта кооператора» (story 7.2, FR-E2).
 *
 * Кооператив не выпускает карту — он свидетельствует, что человек у него
 * состоит. Свидетельство подписывается ключом заверения и едет вместе с цепочкой
 * признания, поэтому проверить его может любой участник сети, не обращаясь к
 * card.coop и не доверяя ему (NFR-5 проекта «Карта кооператора»).
 *
 * Подписывается канонический байтовый образ документа (JCS, RFC 8785) — той же
 * библиотекой, что и документы в `@coopenomics/sdk`, поэтому обе стороны считают
 * один и тот же образ байт в байт. Подпись детерминированная (RFC 6979): один и
 * тот же документ и ключ дают одну и ту же подпись, и эталонные векторы
 * воспроизводимы.
 */
import { Inject, Injectable } from '@nestjs/common';
import canonicalize from 'canonicalize';
import {
  COOP_CREDENTIAL_PORT,
  type ICoopCredentialPort,
  LOGGER_PORT,
  type ILoggerPort,
} from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { CardcoopIdentityService } from '../identity/identity.service';
import {
  CardcoopAttestationType,
  type CardcoopDocumentPayload,
  type CardcoopMembershipPayload,
  type CardcoopRevocationPayload,
  type CardcoopSignedEnvelope,
} from './attestation.types';

/** Сколько раз пытаться доставить документ, включая первую попытку. */
const DELIVERY_ATTEMPTS = 5;

/** Задержка перед повтором, миллисекунды: удваивается до предела. */
const RETRY_BASE_MS = 1_000;

/**
 * Сколько ждать ответа сети на один запрос (3B5-58).
 *
 * Ограничение обязательно: тем же путём уходит запрос раскрытия из быстрой регистрации, а
 * там человек ждёт у экрана. Без него зависший узел сети держал бы соединение до системного
 * таймаута, и пять попыток превращались бы в минуты молчания вместо внятного отказа.
 */
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_MAX_MS = 30_000;

/** Что нужно знать, чтобы выпустить подтверждение. */
export interface MembershipAttestationRequest {
  /** Пайщик, о котором свидетельствует кооператив. */
  username: string;
  /** Карта держателя — идентификатор приходит в уведомлении о связке. */
  cardId: string;
  /** Дата вступления в кооператив, `YYYY-MM-DD`. */
  memberSince: string;
}

/** Исход доставки: что именно приняла или отвергла сеть. */
export interface AttestationDeliveryResult {
  delivered: boolean;
  /** Код ответа последней попытки; `null`, если до сети не дошли вовсе. */
  status: number | null;
  /**
   * Разобранное тело успешного ответа; отсутствует, если тела нет или оно не JSON.
   *
   * Нужно там, где сеть отвечает данными, а не только фактом приёма: подключение возвращает
   * реквизиты клиента (story 7.6/9.2), запрос раскрытия — идентификатор согласия (story 9.3).
   */
  body?: Record<string, unknown>;
  /**
   * Идентификатор, присвоенный сетью принятому подтверждению.
   *
   * Только по нему подтверждение потом отзывается, поэтому он и сохраняется в
   * журнале: прекращение членства кооператив узнаёт из цепи, а там ни карты, ни
   * этого идентификатора нет.
   */
  attestationId?: string;
  /** Причина отказа для журнала и разбора оператором. */
  reason?: string;
}

/** Ошибка, при которой повторять бессмысленно: сеть поняла документ и отвергла его. */
class PermanentDeliveryError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'PermanentDeliveryError';
  }
}

@Injectable()
export class CardcoopAttestationService {
  constructor(
    @Inject(COOP_CREDENTIAL_PORT) private readonly credential: ICoopCredentialPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly identity: CardcoopIdentityService
  ) {
    this.logger.setContext(CardcoopAttestationService.name);
  }

  /**
   * Составляет, подписывает и отправляет подтверждение членства.
   *
   * @param apiUrl — адрес узла сети из конфигурации расширения.
   * @param request — пайщик, карта и дата вступления.
   * @returns Исход доставки; исключение бросается только при ошибке составления
   *   документа — недоставка это рабочая ситуация, её разбирает оператор.
   */
  async issueMembership(apiUrl: string, request: MembershipAttestationRequest): Promise<AttestationDeliveryResult> {
    const envelope = await this.buildMembership(request);
    return this.deliverDocument(`${trimSlash(apiUrl)}/v1/attestations`, envelope);
  }

  /**
   * Составляет, подписывает и отправляет отзыв подтверждения (story 7.3).
   *
   * @param apiUrl — адрес узла сети.
   * @param attestationId — отзываемое подтверждение.
   */
  async revoke(apiUrl: string, attestationId: string): Promise<AttestationDeliveryResult> {
    const payload: CardcoopRevocationPayload = {
      type: CardcoopAttestationType.Revocation,
      coopname: platformSettings().coopname,
      attestation_id: attestationId,
      issued_at: new Date().toISOString(),
      chain_id: await this.credential.getChainId(),
    };

    const envelope = await this.signDocument(payload);
    return this.deliverDocument(`${trimSlash(apiUrl)}/v1/attestations/${attestationId}/revoke`, envelope);
  }

  /** Подписанный конверт подтверждения членства — отдельно от отправки, чтобы его можно было проверить тестом. */
  async buildMembership(request: MembershipAttestationRequest): Promise<CardcoopSignedEnvelope<CardcoopMembershipPayload>> {
    const payload: CardcoopMembershipPayload = {
      type: CardcoopAttestationType.Membership,
      coopname: platformSettings().coopname,
      card_id: request.cardId,
      member_since: request.memberSince,
      issued_at: new Date().toISOString(),
      chain_id: await this.credential.getChainId(),
      identity: await this.identity.build(request.username),
    };

    return this.signDocument(payload);
  }

  /**
   * Канонизирует документ, подписывает его и прикладывает цепочку признания.
   *
   * Пустая цепочка не мешает выпуску, но отмечается в журнале: документ уедет и
   * будет отвергнут как непризнанный, и знать причину лучше здесь, чем гадать по
   * отказам сети.
   *
   * Открыт наружу и не ограничен подтверждениями: анкета по гранту раскрытия
   * (story 7.8) едет в таком же конверте и по той же цепочке признания — иначе
   * получателю пришлось бы проверять кооператива вторым способом.
   *
   * @param payload — документ; подпись накроет его канонический образ целиком.
   * @returns Конверт с тем же документом, подписью и цепочкой признания.
   */
  async signDocument<TPayload extends CardcoopDocumentPayload>(
    payload: TPayload
  ): Promise<CardcoopSignedEnvelope<TPayload>> {
    const canonical = canonicalize(payload);
    if (canonical === undefined) throw new Error('Документ подтверждения не сериализуется в строгий JSON');

    const signature = await this.credential.signWithCertKey(Buffer.from(canonical, 'utf8'));
    const chain = await this.credential.getTrustChain();

    if (chain.length === 0) {
      this.logger.warn(
        `Кооператив ${payload.coopname} не признан в сети: цепочка заверений пуста — документ будет отвергнут`
      );
    }

    return { payload, signature, chain };
  }

  /**
   * Доставляет конверт с повторами.
   *
   * Повторяем только то, что могло получиться при следующей попытке: сеть
   * недоступна или ответила серверной ошибкой. Отказ с разбором документа
   * (4xx) повторять незачем — документ не станет другим, а повторы засоряют
   * журнал и мешают увидеть настоящую причину. Исключение — 429: сеть
   * попросила подождать, а не отвергла документ.
   *
   * @param url — адрес приёмника в сети.
   * @param envelope — подписанный конверт.
   * @returns Исход доставки; исключений не бросает.
   */
  async deliverDocument(
    url: string,
    envelope: CardcoopSignedEnvelope<CardcoopDocumentPayload>
  ): Promise<AttestationDeliveryResult> {
    let lastStatus: number | null = null;
    let lastReason = 'сеть недоступна';

    for (let attempt = 1; attempt <= DELIVERY_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(envelope),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.ok) {
          return { delivered: true, status: response.status, ...(await readSuccessBody(response)) };
        }

        lastStatus = response.status;
        lastReason = await readReason(response);

        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new PermanentDeliveryError(response.status, lastReason);
        }
      } catch (error) {
        if (error instanceof PermanentDeliveryError) {
          this.logger.error(`Сеть карт отвергла документ (${error.status}): ${error.message}`);
          return { delivered: false, status: error.status, reason: error.message };
        }
        lastReason = error instanceof Error ? error.message : String(error);
      }

      if (attempt < DELIVERY_ATTEMPTS) await delay(backoffMs(attempt));
    }

    this.logger.error(`Документ не доставлен в сеть карт после ${DELIVERY_ATTEMPTS} попыток: ${lastReason}`);
    return { delivered: false, status: lastStatus, reason: lastReason };
  }
}

/** Задержка перед повтором: удваивается с каждой попыткой до предела. */
export const backoffMs = (attempt: number): number => Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const trimSlash = (url: string) => url.replace(/\/+$/, '');

/**
 * Идентификатор принятого подтверждения и разобранное тело из ответа сети.
 *
 * Отсутствие тела или неожиданная его форма не считаются провалом доставки:
 * сеть документ приняла, а без идентификатора мы всего лишь не сможем отозвать
 * его автоматически — это разбирает оператор, и терять из-за этого сам факт
 * приёма было бы хуже. Тело отдаётся целиком: подключение и запрос раскрытия
 * читают из него свои данные, и разбирать его дважды незачем.
 */
const readSuccessBody = async (
  response: Response
): Promise<{ attestationId?: string; body?: Record<string, unknown> }> => {
  try {
    const text = await response.text();
    if (!text) return {};
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const id = parsed.attestation_id ?? parsed.id;
    return {
      ...(typeof id === 'string' && id ? { attestationId: id } : {}),
      body: parsed,
    };
  } catch {
    return {};
  }
};

/** Причина отказа из ответа; тело может быть пустым или неJSON — это не должно ронять отправку. */
const readReason = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    if (!text) return `сеть ответила ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: unknown; error?: unknown };
      const message = parsed.message ?? parsed.error;
      return typeof message === 'string' ? message : text;
    } catch {
      return text;
    }
  } catch {
    return `сеть ответила ${response.status}`;
  }
};
