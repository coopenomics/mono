/**
 * Принимающая сторона раскрытий: анкета для быстрой регистрации (story 9.3, FR-F2/F4).
 *
 * Кандидат с картой выбирает кооператив, где его уже верифицировали, и мы просим card.coop
 * спросить его согласия. Дальше всё происходит без нас и без него: держатель разрешает, сеть
 * привозит грант подписанным уведомлением (ADR-2 card.coop), мы немедленно меняем грант на
 * анкету у кооператива-источника — напрямую, минуя card.coop, — и анкета ждёт единственного
 * прочтения в форму.
 *
 * Ответ источника проверяется по цепи, а не по чьему-либо слову: ключ, которым подписана
 * анкета, обязан совпадать с ключом заверения кооператива-источника из `ano::endorsements`
 * главной цепи. Узел кооператива читает цепь сам — ему, в отличие от card.coop, для этого
 * не нужны ни JWKS, ни посредники.
 */
import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import canonicalize from 'canonicalize';
import { Signature } from '@wharfkit/antelope';
import { AnoContract } from 'cooptypes';
import { CHAIN_PORT, type IChainPort, LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { CardcoopAttestationService } from '../attestation/attestation.service';
import {
  CardcoopEntryOutcome,
  CardcoopEntrySessionTypeormEntity,
  CardcoopEntryStatus,
} from '../infrastructure/entities/cardcoop-entry-session.typeorm-entity';

/** Аккаунт цепи, на котором живут заверения сети. */
const ANO = AnoContract.contractName.production;

/** Таблица заверений: кто признан, каким ключом и до какого момента. */
const ENDORSEMENTS_TABLE = AnoContract.Tables.Endorsements.tableName;

/** Заголовок таймаута обмена: источник рядом, а держатель ждёт у экрана. */
const EXCHANGE_TIMEOUT_MS = 15_000;

/** Строка заверения из цепи. */
interface EndorsementRow {
  subject?: string;
  cert_key?: string;
  expires_at?: string;
}

/** Уведомление сети о решении держателя. */
export interface DisclosureDecisionNotification {
  disclosure_id?: string;
  grant?: string;
  from_coopname?: string;
  from_disclosure_url?: string | null;
}

@Injectable()
export class CardcoopDisclosureIntakeService {
  constructor(
    @InjectRepository(CardcoopEntrySessionTypeormEntity)
    private readonly sessions: Repository<CardcoopEntrySessionTypeormEntity>,
    private readonly attestationService: CardcoopAttestationService,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopDisclosureIntakeService.name);
  }

  /**
   * Просит card.coop спросить согласие держателя на перенос анкеты.
   *
   * @param apiUrl — адрес сети из конфигурации расширения.
   * @param sessionId — сессия входа кандидата.
   * @param fromCoopname — выбранный кооператив-источник.
   * @returns Обновлённая сессия: ждём решения держателя.
   * @throws NotFoundException Если сессии нет или источник не из её членств.
   * @throws ConflictException Если сеть не приняла запрос (висит прежний либо недавний отказ).
   */
  async requestDisclosure(
    apiUrl: string,
    sessionId: string,
    fromCoopname: string
  ): Promise<CardcoopEntrySessionTypeormEntity> {
    const session = await this.candidateSession(sessionId);

    if (!session.memberships.some((entry) => entry.coopname === fromCoopname)) {
      // Источник — только из членств, показанных с согласия держателя при входе: просить
      // анкету у кооператива, о членстве в котором человек нам не говорил, нельзя.
      throw new NotFoundException('Кооператив-источник не значится среди членств карты');
    }

    const envelope = await this.attestationService.signDocument({
      type: 'disclosure_request',
      coopname: platformSettings().coopname,
      card_id: session.cardId,
      from_coopname: fromCoopname,
      issued_at: new Date().toISOString(),
      chain_id: platformSettings().blockchain.chainId,
    });

    const result = await this.attestationService.deliverDocument(`${trim(apiUrl)}/v1/disclosures`, envelope);
    const disclosureId = typeof result.body?.id === 'string' ? result.body.id : null;

    if (!result.delivered || !disclosureId) {
      throw new ConflictException(
        result.reason ?? 'Сеть не приняла запрос раскрытия — попробуйте позже либо заполните анкету руками'
      );
    }

    session.disclosureId = disclosureId;
    session.status = CardcoopEntryStatus.AwaitingConsent;
    return this.sessions.save(session);
  }

  /**
   * Держатель разрешил: меняем грант на анкету у источника — немедленно.
   *
   * Немедленно, потому что грант живёт минуты и одноразов: отложить обмен значит его
   * потерять. Ошибка не бросается наружу — уведомление сеть уже доставила, и повторная
   * присылка того же гранта ничего не исправит; исход разбирается по журналу и по состоянию
   * сессии.
   *
   * @param notification — уведомление сети с грантом.
   */
  async handleGranted(notification: DisclosureDecisionNotification): Promise<void> {
    const session = await this.byDisclosure(notification.disclosure_id);
    if (!session) return;

    try {
      if (!notification.grant || !notification.from_disclosure_url || !notification.from_coopname) {
        throw new Error('в уведомлении нет гранта либо адреса источника — источник на старой версии');
      }

      const envelope = await this.fetchProfile(notification.from_disclosure_url, notification.grant);
      await this.acceptProfile(session, envelope, notification.from_coopname);
    } catch (error) {
      this.logger.error(
        `Анкета по согласию ${session.disclosureId} не получена: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Держатель отказал: анкеты не будет, регистрация продолжается руками.
   *
   * @param notification — уведомление сети.
   */
  async handleDenied(notification: DisclosureDecisionNotification): Promise<void> {
    const session = await this.byDisclosure(notification.disclosure_id);
    if (!session) return;

    session.status = CardcoopEntryStatus.Denied;
    await this.sessions.save(session);
    this.logger.info(`Держатель отказал в раскрытии по согласию ${session.disclosureId}`);
  }

  /** Забирает анкету у источника по гранту. */
  private async fetchProfile(
    url: string,
    grant: string
  ): Promise<{ payload: Record<string, unknown>; signature: string }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant }),
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`источник ответил ${response.status}`);

    const envelope = (await response.json()) as { payload?: Record<string, unknown>; signature?: string };
    if (!envelope.payload || typeof envelope.signature !== 'string') {
      throw new Error('ответ источника не является подписанным конвертом');
    }
    return { payload: envelope.payload, signature: envelope.signature };
  }

  /**
   * Проверяет конверт источника и сохраняет анкету.
   *
   * Проверка по цепи: ключ подписи обязан совпадать с действующим ключом заверения
   * кооператива-источника из `ano::endorsements`. Ответ, подписанный кем угодно другим —
   * включая правильный по форме, — анкетой не становится.
   */
  private async acceptProfile(
    session: CardcoopEntrySessionTypeormEntity,
    envelope: { payload: Record<string, unknown>; signature: string },
    fromCoopname: string
  ): Promise<void> {
    const { payload } = envelope;

    if (payload.type !== 'disclosure_profile') throw new Error('источник прислал документ другого вида');
    if (payload.coopname !== fromCoopname) throw new Error('анкету подписал не тот кооператив, у которого просили');
    if (payload.grant_jti !== session.disclosureId) throw new Error('анкета выдана по другому согласию');
    if (payload.card_id !== session.cardId) throw new Error('анкета выдана по другой карте');
    if (payload.to_coopname !== platformSettings().coopname) throw new Error('анкета адресована другому кооперативу');

    await this.verifyByChain(payload, envelope.signature, fromCoopname);

    session.profileType = typeof payload.subject_type === 'string' ? payload.subject_type : null;
    session.profile = (payload.profile as Record<string, unknown>) ?? null;
    session.status = CardcoopEntryStatus.ProfileReady;
    await this.sessions.save(session);

    this.logger.info(`Анкета кандидата получена от ${fromCoopname} по согласию ${session.disclosureId}`);
  }

  /** Подпись конверта против действующего заверения источника в цепи. */
  private async verifyByChain(
    payload: Record<string, unknown>,
    signature: string,
    fromCoopname: string
  ): Promise<void> {
    const canonical = canonicalize(payload);
    if (canonical === undefined) throw new Error('анкета не канонизируется');

    const endorsement = await this.chain.getSingleRow<EndorsementRow>(ANO, ANO, ENDORSEMENTS_TABLE, fromCoopname);
    if (!endorsement?.cert_key) throw new Error(`кооператив ${fromCoopname} не заверен в цепи`);
    if (endorsement.expires_at && Date.parse(`${endorsement.expires_at}Z`) < Date.now()) {
      throw new Error(`заверение кооператива ${fromCoopname} истекло`);
    }

    const signer = Signature.from(signature).recoverMessage(Buffer.from(canonical, 'utf8')).toString();
    if (signer !== endorsement.cert_key) {
      throw new Error('подпись анкеты не сходится с ключом заверения источника в цепи');
    }
  }

  /** Сессия кандидата; пайщику раскрытие не нужно — его анкета и так у нас. */
  private async candidateSession(id: string): Promise<CardcoopEntrySessionTypeormEntity> {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session || session.outcome !== CardcoopEntryOutcome.Candidate) {
      throw new NotFoundException('Сессия входа не найдена — начните заново');
    }
    return session;
  }

  /** Сессия по согласию; отсутствие — норма: уведомление могло пережить сессию. */
  private async byDisclosure(disclosureId?: string): Promise<CardcoopEntrySessionTypeormEntity | null> {
    if (!disclosureId) return null;
    return this.sessions.findOne({ where: { disclosureId } });
  }
}

const trim = (url: string) => url.replace(/\/+$/, '');
