/**
 * Выдающая сторона раскрытий: анкета по гранту card.coop (story 7.8, FR-F3).
 *
 * Зачем это существует. Человек с картой приходит в кооператив B, где его ещё нет. Анкета у
 * него уже заполнена — у нас, потому что мы его верифицировали. Переписывать её заново
 * бессмысленно и вредно: ошибки ввода как раз и порождают расхождения реквизитов, которые
 * потом всплывают сверкой отпечатков. Поэтому анкета едет от нас к B напрямую — но только
 * по согласию человека, удостоверенному грантом card.coop.
 *
 * Через card.coop анкета не проходит никогда (PRD §10 п.9, вариант B): там остаётся один
 * факт — кто у кого взял, когда и по чьему согласию.
 *
 * Отказ всегда один и тот же. Сказать «такого пайщика у нас нет» значит ответить чужому на
 * вопрос о членстве человека — ровно то, что сеть запрещает (архитектура §8). Настоящая
 * причина пишется в журнал кооператива.
 */
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { COOP_CREDENTIAL_PORT, type ICoopCredentialPort, LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  CardcoopAttestationState,
  CardcoopAttestationTypeormEntity,
} from '../infrastructure/entities/cardcoop-attestation.typeorm-entity';
import { CardcoopUsedGrantTypeormEntity } from '../infrastructure/entities/cardcoop-used-grant.typeorm-entity';
import { CardcoopAttestationService } from '../attestation/attestation.service';
import { CardcoopIdentityService } from '../identity/identity.service';
import { CardcoopGrantRejected, CardcoopGrantVerifier } from './grant-verifier.service';
import type { CardcoopGrantClaims } from './grant';
import {
  CardcoopDisclosureType,
  type CardcoopDisclosureDeliveredPayload,
  type CardcoopDisclosureEnvelope,
  type CardcoopDisclosurePayload,
} from './disclosure.types';

@Injectable()
export class CardcoopDisclosureService {
  constructor(
    @InjectRepository(CardcoopAttestationTypeormEntity)
    private readonly attestations: Repository<CardcoopAttestationTypeormEntity>,
    @InjectRepository(CardcoopUsedGrantTypeormEntity)
    private readonly usedGrants: Repository<CardcoopUsedGrantTypeormEntity>,
    private readonly verifier: CardcoopGrantVerifier,
    private readonly identity: CardcoopIdentityService,
    private readonly attestationService: CardcoopAttestationService,
    @Inject(COOP_CREDENTIAL_PORT) private readonly credential: ICoopCredentialPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopDisclosureService.name);
  }

  /**
   * Выдаёт анкету держателя по предъявленному гранту.
   *
   * @param apiUrl — адрес узла сети из конфигурации расширения.
   * @param grant — грант, полученный кооперативом-получателем от card.coop.
   * @returns Конверт с анкетой, подписанный ключом заверения кооператива.
   * @throws CardcoopGrantRejected По любой неудавшейся проверке — с причиной для журнала.
   */
  async disclose(apiUrl: string, grant: string): Promise<CardcoopDisclosureEnvelope> {
    const claims = await this.verifier.verify(apiUrl, grant);
    const username = await this.member(claims.sub);
    const profile = await this.identity.profile(username);

    // Грант расходуется здесь, а не раньше: анкета уже собрана, и после этой строки помешать
    // выдаче может только отказ подписи. Расходовать его до сборки значило бы сжигать
    // согласие человека на наших внутренних неполадках — повторное он давал бы руками.
    await this.spend(claims, username);

    const payload: CardcoopDisclosurePayload = {
      type: CardcoopDisclosureType.Profile,
      coopname: platformSettings().coopname,
      card_id: claims.sub,
      to_coopname: claims.aud,
      grant_jti: claims.jti,
      issued_at: new Date().toISOString(),
      chain_id: await this.credential.getChainId(),
      subject_type: profile.kind,
      profile: profile.data,
    };

    const envelope = await this.attestationService.signDocument(payload);

    // Отметка о передаче замыкает круг в журнале держателя. Она не должна задерживать выдачу
    // и не должна её отменять: анкета уже собрана и подписана, а недоставку отметки видно по
    // журналу кооператива.
    void this.confirm(apiUrl, claims.jti);

    this.logger.info(`Анкета пайщика ${username} выдана кооперативу ${claims.aud} по согласию ${claims.jti}`);
    return envelope;
  }

  /**
   * Пайщик, чьё членство подтверждено этой картой.
   *
   * Раскрытие опирается на действующее членство, а не на факт связки: анкету человека,
   * который у нас больше не состоит, мы не ведём и отвечать за неё не можем.
   *
   * @param cardId — карта держателя из гранта.
   * @returns Учётное имя пайщика.
   * @throws CardcoopGrantRejected Если действующего подтверждения по этой карте нет.
   */
  private async member(cardId: string): Promise<string> {
    const record = await this.attestations.findOne({
      where: { cardId, state: CardcoopAttestationState.Active },
    });

    if (!record) throw new CardcoopGrantRejected(`по карте ${cardId} нет действующего подтверждения членства`);
    return record.username;
  }

  /**
   * Отмечает грант израсходованным.
   *
   * Одноразовость держит первичный ключ, а не проверка перед вставкой: два одновременных
   * запроса с одним грантом прошли бы любую предварительную проверку оба.
   *
   * @param claims — утверждения гранта.
   * @param username — пайщик, чью анкету выдаём.
   * @throws CardcoopGrantRejected Если по этому согласию анкету уже отдавали.
   */
  private async spend(claims: CardcoopGrantClaims, username: string): Promise<void> {
    try {
      await this.usedGrants.insert({
        grantJti: claims.jti,
        cardId: claims.sub,
        username,
        toCoopname: claims.aud,
      });
    } catch {
      throw new CardcoopGrantRejected(`по согласию ${claims.jti} анкета уже выдана`);
    }
  }

  /**
   * Сообщает card.coop, что анкета по гранту передана.
   *
   * @param apiUrl — адрес узла сети.
   * @param grantJti — согласие, по которому выдана анкета.
   */
  private async confirm(apiUrl: string, grantJti: string): Promise<void> {
    try {
      const payload: CardcoopDisclosureDeliveredPayload = {
        type: CardcoopDisclosureType.Delivered,
        coopname: platformSettings().coopname,
        grant_jti: grantJti,
        issued_at: new Date().toISOString(),
        chain_id: await this.credential.getChainId(),
      };

      const envelope = await this.attestationService.signDocument(payload);
      const result = await this.attestationService.deliverDocument(
        `${apiUrl.replace(/\/+$/, '')}/v1/disclosures/delivered`,
        envelope
      );

      if (!result.delivered) {
        this.logger.error(
          `Отметка о передаче анкеты по согласию ${grantJti} не доставлена: ${result.reason ?? 'причина неизвестна'}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Отметка о передаче анкеты по согласию ${grantJti} не отправлена: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
