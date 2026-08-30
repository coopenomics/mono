/**
 * Приём уведомлений о связках от сети «Карта пайщика» (story 7.2, FR-E2).
 *
 * Замыкающее звено главного потока: пайщик выпускает карту на card.coop, сеть
 * сообщает кооперативу, что его пайщик дошёл до карты, и кооператив в ответ
 * свидетельствует членство. Без этого приёмника подтверждение не выпускается
 * никогда — карта остаётся без подтверждённого членства.
 *
 * Уведомление подписано ключом сети и проверяется до всякой обработки: принять
 * неподписанное значило бы выпустить свидетельство о членстве по чужой команде.
 */
import { Body, Controller, ForbiddenException, Headers, Inject, Post, ServiceUnavailableException } from '@nestjs/common';
import canonicalize from 'canonicalize';
import { Signature } from '@wharfkit/antelope';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  ACCOUNT_PORT,
  type IAccountPort,
  LOGGER_PORT,
  type ILoggerPort,
  USER_DIRECTORY_PORT,
  type IUserDirectoryPort,
} from '@coopenomics/innercoop';
import { CardcoopExtension } from '../cardcoop-extension.module';
import { CardcoopMembershipService } from '../membership/membership.service';

/** Заголовок, которым сеть подписывает уведомление. */
const SIGNATURE_HEADER = 'x-cardcoop-signature';

/** Событие о новой связке карты с кооперативом. */
const LINK_CREATED = 'link.created';

/**
 * Тело уведомления.
 *
 * Персональных данных здесь нет и быть не должно: сеть сообщает факт связки, а
 * кто это, кооператив знает сам — `external_subject` указывает на учётную запись
 * в его собственном CoopID.
 */
interface LinkCreatedNotification {
  event?: string;
  card_id?: string;
  coopname?: string;
  external_subject?: string;
  origin?: string;
  occurred_at?: string;
  event_id?: string;
}

@Controller('v1/extensions/cardcoop')
export class CardcoopLinkWebhookController {
  constructor(
    private readonly extension: CardcoopExtension,
    private readonly membership: CardcoopMembershipService,
    @Inject(USER_DIRECTORY_PORT) private readonly directory: IUserDirectoryPort,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopLinkWebhookController.name);
  }

  /**
   * Принимает уведомление о связке и выпускает подтверждение членства.
   *
   * Отвечает успехом сразу после проверки подписи и принадлежности: выпуск
   * подтверждения идёт своим ходом с повторами, и держать сеть в ожидании,
   * пока мы ходим в цепь и обратно, незачем — она бы просто отсчитала таймаут и
   * прислала уведомление ещё раз.
   */
  @Post('webhooks')
  async handleLinkCreated(
    @Body() notification: LinkCreatedNotification,
    @Headers(SIGNATURE_HEADER) signature?: string
  ): Promise<{ accepted: boolean }> {
    this.verify(notification, signature);

    if (notification.event !== LINK_CREATED) return { accepted: true };
    if (notification.coopname !== platformSettings().coopname) {
      // Чужое уведомление — свидетельствовать о пайщике другого кооператива мы не вправе.
      throw new ForbiddenException('Уведомление адресовано другому кооперативу');
    }

    const { card_id: cardId, external_subject: subject } = notification;
    if (!cardId || !subject) throw new ForbiddenException('В уведомлении нет карты или учётной записи');

    void this.issue(cardId, subject);
    return { accepted: true };
  }

  /**
   * Выпускает подтверждение по связке.
   *
   * Отдельно от ответа сети: ошибка здесь не должна выглядеть для card.coop
   * отказом принять уведомление — она разбирается по журналу и по состоянию
   * записи, а повторная присылка того же уведомления ничего не исправит.
   */
  private async issue(cardId: string, subject: string): Promise<void> {
    try {
      const user = await this.directory.findBySubject(subject);
      const memberSince = await this.memberSince(user.username);

      await this.membership.issue(this.extension.config.api_url, user.username, cardId, memberSince);
    } catch (error) {
      this.logger.error(
        `Подтверждение по связке карты ${cardId} не выпущено: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Дата приёма пайщика в кооператив.
   *
   * Берётся из цепи, а не из учётной записи: свидетельство о членстве обязано
   * опираться на то, что записала цепь, — именно её потом проверяет третья
   * сторона. Отсутствие записи означает, что пайщик в цепи не принят, и
   * свидетельствовать не о чем.
   */
  private async memberSince(username: string): Promise<string> {
    const account = await this.accounts.getChainAccount(username);
    const registeredAt = account?.registered_at;

    if (!registeredAt) throw new Error(`Пайщик ${username} не принят в кооператив в цепи`);

    return new Date(registeredAt).toISOString().slice(0, 10);
  }

  /**
   * Проверяет подпись уведомления открытым ключом сети.
   *
   * Незаданный ключ — не повод принять неподписанное: пока кооператив не получил
   * ключ при включении в реестр, проверять нечем, и единственный безопасный
   * ответ — отказ с внятной причиной.
   */
  private verify(notification: LinkCreatedNotification, signature?: string): void {
    const key = this.extension.config.webhook_key;
    if (!key) throw new ServiceUnavailableException('Ключ проверки уведомлений не задан');
    if (!signature) throw new ForbiddenException('Уведомление без подписи');

    const canonical = canonicalize(notification);
    if (canonical === undefined) throw new ForbiddenException('Уведомление не является строгим JSON');

    let matches = false;
    try {
      matches = Signature.from(signature).recoverMessage(Buffer.from(canonical, 'utf8')).toString() === key;
    } catch {
      matches = false;
    }

    if (!matches) throw new ForbiddenException('Подпись уведомления не сходится с ключом сети');
  }
}
