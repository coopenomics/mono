/**
 * Ведение членства в сети «Карта пайщика» на стороне кооператива (story 7.2/7.3).
 *
 * Отвечает на два вопроса, на которые не отвечает сам по себе ни документ, ни
 * цепь: какое подтверждение выдано по этому пайщику и что с ним делать, когда
 * членство прекращается. Отзыв возможен только по идентификатору, который
 * присваивает card.coop при приёме, а прекращение членства кооператив узнаёт из
 * цепи — там ни карты, ни идентификатора нет, только пайщик. Журнал и связывает
 * одно с другим.
 */
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import {
  CardcoopAttestationState,
  CardcoopAttestationTypeormEntity,
} from '../infrastructure/entities/cardcoop-attestation.typeorm-entity';
import { CardcoopPendingExitTypeormEntity } from '../infrastructure/entities/cardcoop-pending-exit.typeorm-entity';
import { CardcoopPendingLinkTypeormEntity } from '../infrastructure/entities/cardcoop-pending-link.typeorm-entity';
import { CardcoopAttestationService, type AttestationDeliveryResult } from '../attestation/attestation.service';

@Injectable()
export class CardcoopMembershipService {
  constructor(
    @InjectRepository(CardcoopAttestationTypeormEntity)
    private readonly attestations: Repository<CardcoopAttestationTypeormEntity>,
    @InjectRepository(CardcoopPendingExitTypeormEntity)
    private readonly pendingExits: Repository<CardcoopPendingExitTypeormEntity>,
    @InjectRepository(CardcoopPendingLinkTypeormEntity)
    private readonly pendingLinks: Repository<CardcoopPendingLinkTypeormEntity>,
    private readonly attestationService: CardcoopAttestationService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopMembershipService.name);
  }

  /**
   * Выпускает подтверждение членства и запоминает его исход.
   *
   * Идемпотентно по паре «пайщик и карта»: повторное уведомление о той же связке
   * не порождает второго свидетельства, а обновляет уже имеющееся. Уведомления
   * приходят по сети и повторяются при недоставке — без этого один пайщик
   * оброс бы дублями.
   *
   * @param apiUrl — адрес узла сети из конфигурации расширения.
   * @param username — пайщик, о котором свидетельствует кооператив.
   * @param cardId — карта держателя из уведомления о связке.
   * @param memberSince — дата вступления, `YYYY-MM-DD`.
   * @param cardNumber — номер карты для показа в столе пайщика; `null`, если сеть его не
   *   прислала (установка сети старее story 7.4).
   */
  async issue(
    apiUrl: string,
    username: string,
    cardId: string,
    memberSince: string,
    cardNumber: string | null = null
  ): Promise<void> {
    const existing = await this.attestations.findOne({ where: { username, cardId } });

    if (existing?.state === CardcoopAttestationState.Active) {
      await this.catchUpCardNumber(existing, cardNumber);
      this.logger.info(`Членство пайщика ${username} на карте ${cardId} уже подтверждено — повтор пропущен`);
      return;
    }

    const record =
      existing ??
      this.attestations.create({ username, cardId, memberSince, state: CardcoopAttestationState.Pending });

    record.memberSince = memberSince;
    if (cardNumber) record.cardNumber = cardNumber;
    await this.attestations.save(record);

    const result = await this.attestationService.issueMembership(apiUrl, { username, cardId, memberSince });
    this.applyOutcome(record, result, username);

    await this.attestations.save(record);
  }

  /**
   * Дописывает номер карты к уже подтверждённому членству.
   *
   * У записей, заведённых до story 7.4, номера нет, а повторное уведомление о связке —
   * единственный случай, когда он приезжает. Без этого стол пайщика показывал бы карту
   * без номера до самого выхода человека из кооператива.
   *
   * @param record — запись журнала с действующим членством.
   * @param cardNumber — номер из уведомления; `null` — сеть его не прислала.
   */
  private async catchUpCardNumber(
    record: CardcoopAttestationTypeormEntity,
    cardNumber: string | null
  ): Promise<void> {
    if (!cardNumber || record.cardNumber === cardNumber) return;

    record.cardNumber = cardNumber;
    await this.attestations.save(record);
  }

  /**
   * Переносит исход отправки в запись журнала.
   *
   * Отказ по существу повторять нечем, недоставку — можно: состояния разные, чтобы
   * оператор видел, где ждать, а где разбираться.
   *
   * @param record — запись журнала.
   * @param result — что ответила сеть.
   * @param username — пайщик; нужен только для внятного сообщения в журнале.
   */
  private applyOutcome(
    record: CardcoopAttestationTypeormEntity,
    result: AttestationDeliveryResult,
    username: string
  ): void {
    if (!result.delivered) {
      record.state =
        result.status && result.status >= 400 && result.status < 500
          ? CardcoopAttestationState.Rejected
          : CardcoopAttestationState.Pending;
      record.lastError = result.reason ?? null;
      return;
    }

    record.state = CardcoopAttestationState.Active;
    record.attestationId = result.attestationId ?? null;
    record.lastError = null;

    if (!result.attestationId) {
      this.logger.warn(
        `Сеть приняла подтверждение пайщика ${username}, но не назвала его идентификатор — автоматический отзыв будет невозможен`
      );
    }
  }

  /**
   * Запоминает карту, связанную до приёма в пайщики (story 7.5).
   *
   * Свидетельствовать в этот момент не о чем: совет ещё не решил, и в цепи нет даты приёма,
   * на которую документ обязан опираться. Но и потерять связку нельзя — человек пришёл со
   * своей картой именно затем, чтобы не заводить вторую.
   *
   * @param username — вступающий кандидат.
   * @param cardId — карта держателя из уведомления о связке.
   * @param cardNumber — номер карты для показа в столе, пока свидетельства нет.
   */
  async rememberLink(username: string, cardId: string, cardNumber: string | null): Promise<void> {
    await this.pendingLinks.save(this.pendingLinks.create({ username, cardId, cardNumber }));
    this.logger.info(`Карта ${cardId} связана кандидатом ${username} до приёма — свидетельство ждёт решения совета`);
  }

  /**
   * Выпускает подтверждение по связке, ждавшей приёма (story 7.5).
   *
   * Вызывается, когда цепь записала приём пайщика. Отсутствие ожидающей записи — норма:
   * большинство принимаемых карту не связывали, и молчать тут правильно.
   *
   * @param apiUrl — адрес узла сети из конфигурации расширения.
   * @param username — принятый пайщик.
   * @param memberSince — дата приёма, `YYYY-MM-DD`.
   */
  async issuePendingLink(apiUrl: string, username: string, memberSince: string): Promise<void> {
    const pending = await this.pendingLinks.findOne({ where: { username } });
    if (!pending) return;

    await this.issue(apiUrl, username, pending.cardId, memberSince, pending.cardNumber);
    await this.pendingLinks.delete({ username });
  }

  /**
   * Карта, ждущая приёма, — для показа в столе пайщика (story 7.4).
   *
   * @param username — пайщик.
   * @returns Ожидающая связка либо `null`.
   */
  async pendingLink(username: string): Promise<CardcoopPendingLinkTypeormEntity | null> {
    return this.pendingLinks.findOne({ where: { username } });
  }

  /** Запоминает начатый выход: в момент завершения цепь назовёт только процесс, но не пайщика. */
  async rememberExit(exitHash: string, username: string, coopname: string): Promise<void> {
    await this.pendingExits.save(this.pendingExits.create({ exitHash, username, coopname }));
  }

  /** Выход отклонён советом — членство сохраняется, запоминать больше нечего. */
  async forgetExit(exitHash: string): Promise<void> {
    await this.pendingExits.delete({ exitHash });
  }

  /**
   * Отзывает подтверждения пайщика, чей выход из кооператива завершён.
   *
   * Отсутствие записи о выходе не считается ошибкой: расширение могли поставить
   * позже начала процесса, и молчать об этом хуже, чем не сделать ничего, —
   * поэтому пишем в журнал и выходим.
   */
  async revokeByCompletedExit(apiUrl: string, exitHash: string): Promise<void> {
    const pending = await this.pendingExits.findOne({ where: { exitHash } });

    if (!pending) {
      this.logger.warn(`Выход ${exitHash} завершён, но пайщик по нему неизвестен — подтверждение не отозвано`);
      return;
    }

    await this.revokeAllFor(apiUrl, pending.username);
    await this.pendingExits.delete({ exitHash });
  }

  /**
   * Отзывает все действующие подтверждения пайщика.
   *
   * Подтверждение без идентификатора отозвать нечем: сеть его либо не приняла,
   * либо не назвала. Помечаем такое отозванным локально и говорим об этом —
   * иначе кооператив считал бы членство прекращённым, а сеть показывала бы его
   * действующим.
   */
  private async revokeAllFor(apiUrl: string, username: string): Promise<void> {
    const active = await this.attestations.find({
      where: { username, state: CardcoopAttestationState.Active },
    });

    for (const record of active) {
      if (!record.attestationId) {
        record.state = CardcoopAttestationState.Revoked;
        record.revokedAt = new Date();
        record.lastError = 'Сеть не назвала идентификатор подтверждения — отзыв нужно провести вручную';
        await this.attestations.save(record);
        this.logger.error(
          `Членство пайщика ${username} прекращено, но подтверждение в сети отозвать нечем: идентификатор неизвестен`
        );
        continue;
      }

      const result = await this.attestationService.revoke(apiUrl, record.attestationId);

      if (result.delivered) {
        record.state = CardcoopAttestationState.Revoked;
        record.revokedAt = new Date();
        record.lastError = null;
      } else {
        record.lastError = result.reason ?? null;
        this.logger.error(
          `Отзыв подтверждения ${record.attestationId} пайщика ${username} не доставлен: ${result.reason ?? 'причина неизвестна'}`
        );
      }

      await this.attestations.save(record);
    }
  }

  /** Подтверждения, застрявшие в недоставке, — для показа оператору. */
  async findUndelivered(): Promise<CardcoopAttestationTypeormEntity[]> {
    return this.attestations.find({
      where: [
        { state: CardcoopAttestationState.Pending },
        { state: CardcoopAttestationState.Rejected, lastError: Not(IsNull()) },
      ],
      order: { updatedAt: 'DESC' },
    });
  }
}
