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
 *
 * Ключ проверки читается из цепи, а не из настроек. Сеть публикует его отдельным
 * разрешением на аккаунте АНО — по той же схеме, по которой право заверения
 * (`cert`) отделено от распорядительного ключа: у каждого назначения свой ключ,
 * и ротация любого из них не трогает остальные. Ручного ввода ключей нет нигде:
 * это гарантированные опечатки, мёртвая ротация и канал для подделки.
 */
import { Body, Controller, ForbiddenException, Headers, Inject, Post, ServiceUnavailableException } from '@nestjs/common';
import canonicalize from 'canonicalize';
import { Signature } from '@wharfkit/antelope';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  ACCOUNT_PORT,
  COOP_CREDENTIAL_PORT,
  type IAccountPort,
  type ICoopCredentialPort,
  LOGGER_PORT,
  type ILoggerPort,
  USER_DIRECTORY_PORT,
  type IUserDirectoryPort,
} from '@coopenomics/innercoop';
import { CardcoopExtension } from '../cardcoop.extension';
import { CardcoopMembershipService } from '../membership/membership.service';
import { chainDate } from '../membership/chain-date';
import { CardcoopDisclosureIntakeService } from '../entry/disclosure-intake.service';

/** Заголовок, которым сеть подписывает уведомление. */
const SIGNATURE_HEADER = 'x-cardcoop-signature';

/** Аккаунт цепи, на котором сеть публикует свои служебные ключи. */
const NETWORK_ACCOUNT = 'ano';

/** Разрешение с ключом подписи уведомлений — отдельное от права заверения `cert`. */
const WEBHOOK_PERMISSION = 'cardcoop';

/**
 * Сколько держать прочитанный из цепи ключ.
 *
 * Кэш экономит поход в цепь на каждом уведомлении, а несовпадение подписи
 * обходит его принудительно — так ротация ключа сети подхватывается первым же
 * уведомлением, подписанным новым ключом, без ожидания истечения кэша.
 */
const KEY_CACHE_MS = 5 * 60 * 1000;

/** Событие о новой связке карты с кооперативом. */
const LINK_CREATED = 'link.created';

/** Решения держателя по раскрытию анкеты (story 9.3, ADR-2 card.coop). */
const DISCLOSURE_GRANTED = 'disclosure.granted';
const DISCLOSURE_DENIED = 'disclosure.denied';
const DISCLOSURE_EXPIRED = 'disclosure.expired';

/** Держатель удалил карту: связка и свидетельство больше ни о чём не говорят (3B5-60). */
const CARD_DELETED = 'card.deleted';

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
  /** Номер карты для показа в столе пайщика; у старых установок сети его нет (story 7.4). */
  card_number?: string | null;
  coopname?: string;
  external_subject?: string;
  origin?: string;
  occurred_at?: string;
  event_id?: string;
}

@Controller('v1/extensions/cardcoop')
export class CardcoopLinkWebhookController {
  private cachedKey: { value: string; readAt: number } | null = null;

  constructor(
    private readonly extension: CardcoopExtension,
    private readonly membership: CardcoopMembershipService,
    private readonly disclosureIntake: CardcoopDisclosureIntakeService,
    @Inject(USER_DIRECTORY_PORT) private readonly directory: IUserDirectoryPort,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    @Inject(COOP_CREDENTIAL_PORT) private readonly credential: ICoopCredentialPort,
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
    await this.verify(notification, signature);

    if (this.routeAside(notification)) return { accepted: true };

    if (notification.event !== LINK_CREATED) return { accepted: true };
    if (notification.coopname !== platformSettings().coopname) {
      // Чужое уведомление — свидетельствовать о пайщике другого кооператива мы не вправе.
      throw new ForbiddenException('Уведомление адресовано другому кооперативу');
    }

    const { card_id: cardId, card_number: cardNumber, external_subject: subject } = notification;
    if (!cardId || !subject) throw new ForbiddenException('В уведомлении нет карты или учётной записи');

    void this.issue(cardId, subject, cardNumber ?? null);
    return { accepted: true };
  }

  /**
   * Разводит события, не относящиеся к связке.
   *
   * Проверка принадлежности к ним не применяется, и это не упущение:
   *
   * - решения по раскрытиям адресованы не кооперативу карты, а получателю анкеты, и сессию
   *   находит идентификатор согласия, который выдавали нам;
   * - удаление карты адресовано всем, кто был с ней связан, а стереть у себя чужую карту
   *   невозможно — своих записей о ней просто нет.
   *
   * Обработка идёт своим ходом: ответить сети нужно сразу, а держать её в ожидании, пока мы
   * ходим к источнику анкеты, незачем — она бы отсчитала таймаут и прислала уведомление ещё раз.
   *
   * @param notification — проверенное подписью уведомление.
   * @returns `true`, если событие обработано здесь и до связки дело не дойдёт.
   */
  private routeAside(notification: LinkCreatedNotification): boolean {
    switch (notification.event) {
      case DISCLOSURE_GRANTED:
        void this.disclosureIntake.handleGranted(notification as never);
        return true;
      case DISCLOSURE_DENIED:
        void this.disclosureIntake.handleDenied(notification as never);
        return true;
      case DISCLOSURE_EXPIRED:
        void this.disclosureIntake.handleExpired(notification as never);
        return true;
      case CARD_DELETED:
        if (notification.card_id) void this.membership.forgetCard(notification.card_id);
        return true;
      default:
        return false;
    }
  }

  /**
   * Выпускает подтверждение по связке.
   *
   * Отдельно от ответа сети: ошибка здесь не должна выглядеть для card.coop
   * отказом принять уведомление — она разбирается по журналу и по состоянию
   * записи, а повторная присылка того же уведомления ничего не исправит.
   */
  private async issue(cardId: string, subject: string, cardNumber: string | null): Promise<void> {
    try {
      const user = await this.directory.findBySubject(subject);
      const memberSince = await this.memberSince(user.username);

      // Кандидат ещё не принят: свидетельствовать не о чем, но и терять связку нельзя —
      // человек пришёл со своей картой ровно затем, чтобы не заводить вторую (story 7.5).
      if (!memberSince) {
        await this.membership.rememberLink(user.username, cardId, cardNumber);
        return;
      }

      await this.membership.issue(this.extension.config.api_url, user.username, cardId, memberSince, cardNumber);
    } catch (error) {
      this.logger.error(
        `Подтверждение по связке карты ${cardId} не выпущено: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Дата приёма пайщика в кооператив.
   *
   * Источник — реестр пайщиков цепи (`soviet::participants` в области кооператива), а не
   * строка `registrator::accounts`: та заводится при создании аккаунта любому кандидату, и
   * её `registered_at` — момент регистрации аккаунта, а не приёма. Свидетельство членства
   * по ней получал бы кандидат, которого совет ещё не принимал, — то есть документ лгал бы.
   * Строка реестра пайщиков появляется только решением о приёме (`confirmreg`/`adduser` →
   * `soviet::addpartcpnt`) и удаляется при выходе — её существование и есть членство.
   *
   * Пустая дата — не ошибка: так выглядит кандидат, который связал карту на этапе
   * вступления (story 7.5). Связка в этом случае ждёт решения совета, а свидетельство
   * выпускается по записи цепи о приёме.
   *
   * @param username — пайщик или кандидат.
   * @returns Дата приёма `YYYY-MM-DD`; `null`, если человек не принят в кооператив.
   */
  private async memberSince(username: string): Promise<string | null> {
    const account = await this.accounts.getAccount(username);
    const createdAt = account.participant_account?.created_at;

    if (!createdAt) return null;

    return chainDate(String(createdAt));
  }

  /**
   * Проверяет подпись уведомления ключом сети из цепи.
   *
   * Несовпадение с закэшированным ключом — не сразу отказ: сначала ключ
   * перечитывается из цепи мимо кэша. Если сеть только что ротировала ключ,
   * первое же уведомление, подписанное новым, проходит без простоя; если подпись
   * действительно чужая — второе чтение вернёт тот же ключ, и последует отказ.
   */
  private async verify(notification: LinkCreatedNotification, signature?: string): Promise<void> {
    if (!signature) throw new ForbiddenException('Уведомление без подписи');

    const canonical = canonicalize(notification);
    if (canonical === undefined) throw new ForbiddenException('Уведомление не является строгим JSON');

    let signer: string;
    try {
      signer = Signature.from(signature).recoverMessage(Buffer.from(canonical, 'utf8')).toString();
    } catch {
      throw new ForbiddenException('Подпись уведомления не разбирается');
    }

    if (signer === (await this.networkKey(false))) return;
    if (signer === (await this.networkKey(true))) return;

    throw new ForbiddenException('Подпись уведомления не сходится с ключом сети');
  }

  /**
   * Ключ подписи уведомлений с аккаунта сети в цепи.
   *
   * Неопубликованный ключ закрывает приём с внятной причиной: проверять нечем,
   * а принимать непроверенное — значит выпускать свидетельства по чужой команде.
   */
  private async networkKey(fresh: boolean): Promise<string> {
    if (!fresh && this.cachedKey && Date.now() - this.cachedKey.readAt < KEY_CACHE_MS) {
      return this.cachedKey.value;
    }

    const key = await this.credential.getPermissionKey(NETWORK_ACCOUNT, WEBHOOK_PERMISSION);
    if (!key) {
      throw new ServiceUnavailableException(
        `Ключ уведомлений сети не опубликован в цепи (разрешение ${WEBHOOK_PERMISSION} аккаунта ${NETWORK_ACCOUNT})`
      );
    }

    this.cachedKey = { value: key, readAt: Date.now() };
    return key;
  }
}
