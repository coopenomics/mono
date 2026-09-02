import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SignJWT } from 'jose';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort, EndorsementRecord, ServedCooperative } from '~/domain/common/ports/blockchain.port';
import { NOTIFICATION_PORT } from '@coopenomics/innercoop';
import type { INotificationPort } from '@coopenomics/innercoop';
import { ACCOUNT_DATA_PORT } from '~/domain/account/ports/account-data.port';
import type { AccountDataPort } from '~/domain/account/ports/account-data.port';
import { CERT_KEY_CRYPTO_PORT } from '~/domain/auth-v2/ports/cert-key-crypto.port';
import type { ICertKeyCrypto } from '~/domain/auth-v2/ports/cert-key-crypto.port';
import {
  CertKeyService,
  TRUST_ANCHOR_ACCOUNT,
  TRUST_ANCHOR_STEWARD,
} from '~/application/auth-v2/certificate/cert-key.service';

/**
 * Тип подписанного заверения. Отличается от типа удостоверения пайщика намеренно:
 * проверяющий не должен иметь возможности принять одно за другое — иначе звено
 * цепочки удалось бы подсунуть вместо самого удостоверения.
 */
const ENDORSEMENT_TYP = 'coop-endorsement+jws';

/** Срок корневого заверения — пять лет. Столько же допускает контракт. */
const ROOT_ENDORSEMENT_SECONDS = 5 * 365 * 24 * 3600 - 3600;

/**
 * За сколько до истечения заверение продлевается.
 *
 * Те же девяносто суток, с которых начинают уходить предупреждения человеку.
 * Совпадение не случайно: пока автоматика справляется сама, человек ничего не
 * получает; предупреждения означают, что она справиться не смогла.
 */
const RENEW_BEFORE_SECONDS = 90 * 24 * 3600;

/**
 * Срок заверения обслуживаемого кооператива — месяц. Столько же допускает контракт.
 *
 * Месяц достаточно короток, чтобы прекращение обслуживания срабатывало быстро, и
 * достаточно длинен, чтобы пережить недоступность сети или остановку оператора на
 * несколько дней.
 */
const SPOKE_ENDORSEMENT_SECONDS = 30 * 24 * 3600;

/**
 * За сколько до истечения продлевается заверение обслуживаемого — половина срока.
 *
 * Это и есть запас на случай, когда оператор не работал: продление начинается с
 * середины месяца, и у него остаётся ещё две недели, прежде чем кооператив
 * выпадет из цепочки.
 */
const SPOKE_RENEW_BEFORE_SECONDS = 15 * 24 * 3600;

/**
 * Статус кооператива в реестре — он же условие обслуживания.
 *
 * Ожидание: заверения нет, удостоверения не проходят проверку. Действующий:
 * заверение выдаётся и продлевается. Заблокированный: продление прекращается, и
 * последнее заверение гаснет само в пределах месяца — отзывать ничего не нужно.
 */
enum CooperativeStatus {
  Pending = 'pending',
  Active = 'active',
  Blocked = 'blocked',
}

/**
 * Выпуск заверений — второго ответа, без которого удостоверение пайщика ничего не
 * доказывает.
 *
 * Подпись под удостоверением говорит, что его выпустил обладатель ключа
 * кооператива. Она не говорит, вправе ли он их выпускать: любой, кто завёл себе
 * аккаунт и ключ, получил бы неотличимое от настоящего удостоверение. Заверение и
 * отвечает на второй вопрос — вышестоящий признаёт, что этим ключом такой-то
 * вправе заверять.
 *
 * Что здесь делается само. Только самозаверение: установка, ведущая аккаунт якоря,
 * заверяет им саму себя. Это ровно тот же самозапуск, каким уже работает публикация
 * ключа заверения якоря, и другого способа получить первое звено нет — ждать, что
 * кто-то нажмёт кнопку, значит оставить сеть без корня.
 *
 * Что здесь не делается. Заверение постороннего оператора — осознанное событие,
 * а не расписание, и автоматики под него нет намеренно.
 *
 * Обслуживаемым кооперативам заверения продлеваются по расписанию: список берётся
 * из цепи ({@link BlockchainPort.getServedCooperatives}), а не из кабинета.
 */
@Injectable()
export class EndorsementService implements OnApplicationBootstrap {
  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    private readonly certKeyService: CertKeyService,
    @Inject(CERT_KEY_CRYPTO_PORT) private readonly crypto: ICertKeyCrypto,
    @Inject(NOTIFICATION_PORT) private readonly notificationPort: INotificationPort,
    @Inject(ACCOUNT_DATA_PORT) private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService,
  ) {}

  /**
   * Довести цепочку доверия до рабочего состояния при старте. Ошибки не роняют
   * приложение: без заверения удостоверения выпускаются, просто помечаются
   * неподтверждёнными — а вот упавший из-за этого бэкенд не работает совсем.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureAnchorEndorsesOperator();
      // Свежая установка не должна ждать до ночи, чтобы заверить обслуживаемых.
      await this.renewServedEndorsements();
    } catch (e) {
      this.logger.warn(
        `Цепочка доверия не выстроена: ${e instanceof Error ? e.message : String(e)}. Удостоверения будут выпускаться неподтверждёнными.`,
        'EndorsementService',
      );
    }
  }

  /**
   * Заверяет установку от имени якоря доверия — но только у той, которая якорь
   * ведёт, и только когда цепь это подтверждает.
   *
   * Условия те же, при которых публикуется ключ заверения якоря: установка
   * принадлежит ведущему кооперативу, аккаунт якоря заведён, распорядительные
   * права на него переданы этому кооперативу по имени. Не выполнено любое — тихо
   * выходим: это не сбой, а «ещё не завели».
   *
   * Идемпотентно: действующее заверение с тем же ключом и запасом больше
   * девяноста суток не переписывается.
   */
  async ensureAnchorEndorsesOperator(): Promise<{ issued: boolean }> {
    if (config.coopname !== TRUST_ANCHOR_STEWARD) return { issued: false };

    const anchorAccount = await this.blockchainPort.getAccount(TRUST_ANCHOR_ACCOUNT);
    if (!anchorAccount) return { issued: false };

    if (!(await this.blockchainPort.canManageAccount(TRUST_ANCHOR_ACCOUNT, config.coopname)))
      return { issued: false };

    // Ключи заверения обеих сторон обязаны быть в цепи: якорь подписывает своим,
    // а признаёт — ключ кооператива, и признавать нечего, пока его там нет.
    await this.certKeyService.ensurePublished();
    await this.certKeyService.ensureAnchorPublished();

    const anchorKey = await this.blockchainPort.getCertPublicKey(TRUST_ANCHOR_ACCOUNT);
    const operatorKey = await this.blockchainPort.getCertPublicKey(config.coopname);
    if (!anchorKey || !operatorKey) return { issued: false };

    const existing = await this.blockchainPort.getEndorsement(config.coopname);
    if (existing && this.isFresh(existing, operatorKey, RENEW_BEFORE_SECONDS)) return { issued: false };

    await this.issue({
      issuer: TRUST_ANCHOR_ACCOUNT,
      issuerKey: anchorKey,
      subject: config.coopname,
      subjectKey: operatorKey,
      lifetimeSeconds: ROOT_ENDORSEMENT_SECONDS,
      signer: config.coopname,
    });

    this.logger.log(
      `Якорь ${TRUST_ANCHOR_ACCOUNT} заверил ${config.coopname}: цепочка доверия замкнута на корень`,
      'EndorsementService',
    );
    return { issued: true };
  }

  /**
   * Продлевает заверения кооперативам, которых оператор обслуживает.
   *
   * Раз в сутки, а не по обращению пайщика: кооператив, куда месяц никто не
   * заходил, иначе остался бы без действующего заверения ровно в тот момент,
   * когда оно кому-то понадобилось.
   *
   * Продлевает всегда оператор — только у него ключ, которым подпись делается.
   * Сам кооператив продлить своё заверение не может и не должен: тогда признание
   * выдавал бы себе тот, кого признают.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async renewServedEndorsements(): Promise<{ renewed: string[] }> {
    const operator = config.coopname;
    const renewed: string[] = [];

    // Заверять вправе только заверенный. Проверяем это до обхода, а не полагаемся
    // на отказ цепи: иначе на каждый обслуживаемый кооператив уйдёт по заведомо
    // проваленной транзакции.
    const own = await this.blockchainPort.getEndorsement(operator);
    if (!own || this.secondsLeft(own) <= 0) {
      this.logger.warn(
        `Заверение оператора ${operator} отсутствует или истекло — обслуживаемым кооперативам заверения не продлеваются`,
        'EndorsementService',
      );
      return { renewed };
    }

    const operatorKey = await this.blockchainPort.getCertPublicKey(operator);
    if (!operatorKey) return { renewed };

    const served = await this.blockchainPort.getServedCooperatives(operator);

    for (const coop of served) {
      try {
        if (await this.renewOne(coop, operator, operatorKey)) renewed.push(coop.username);
      } catch (e) {
        // Один неподатливый кооператив не должен оставить без продления остальных.
        this.logger.warn(
          `Заверение ${coop.username} не продлено: ${e instanceof Error ? e.message : String(e)}`,
          'EndorsementService',
        );
      }
    }

    if (renewed.length)
      this.logger.log(`Продлены заверения: ${renewed.join(', ')}`, 'EndorsementService');

    return { renewed };
  }

  /**
   * Продлевает заверение одному кооперативу, если оно ему сейчас положено.
   *
   * Не действующий в реестре — пропускаем молча. Заблокированному заверение не
   * отзывается: оно гаснет само в пределах своего срока, и это тот же результат
   * без лишней записи в цепь.
   */
  private async renewOne(coop: ServedCooperative, operator: string, operatorKey: string): Promise<boolean> {
    if (coop.status !== CooperativeStatus.Active) return false;

    // Заверяется конкретный ключ. Пока кооператив не опубликовал право заверения,
    // признавать нечего — и это не сбой, а «ещё не поднялся».
    const coopKey = await this.blockchainPort.getCertPublicKey(coop.username);
    if (!coopKey) return false;

    const existing = await this.blockchainPort.getEndorsement(coop.username);
    if (existing && this.isFresh(existing, coopKey, SPOKE_RENEW_BEFORE_SECONDS)) return false;

    await this.issue({
      issuer: operator,
      issuerKey: operatorKey,
      subject: coop.username,
      subjectKey: coopKey,
      lifetimeSeconds: SPOKE_ENDORSEMENT_SECONDS,
    });
    return true;
  }

  /**
   * Предупреждает председателя, что заверение кооператива подходит к концу.
   *
   * Раз в неделю, начиная за девяносто суток, и так до тех пор, пока срок не
   * продлят. Не одно письмо и не одно с повтором: письмо за три месяца до срока
   * гарантированно потеряется, а еженедельное напоминание сохраняет тринадцать
   * недель на действия и при этом не даёт забыть.
   *
   * Предупреждение означает, что автоматика не справилась: продление начинается с
   * тех же девяноста суток. Пока она справляется, человек не получает ничего.
   *
   * Продлить своё заверение кооператив сам не может — подпись ставит тот, кто
   * заверял. Поэтому предупреждение и адресовано человеку: дальше нужен разговор,
   * а не транзакция.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async warnAboutExpiringEndorsement(): Promise<{ warned: boolean }> {
    try {
      const coopname = config.coopname;
      const own = await this.blockchainPort.getEndorsement(coopname);
      if (!own) return { warned: false };

      const left = this.secondsLeft(own);
      if (left > RENEW_BEFORE_SECONDS) return { warned: false };

      const chairman = await this.resolveChairman();
      if (!chairman) return { warned: false };

      const payload: Workflows.EndorsementExpiring.IPayload = {
        chairmanName: await this.accountPort.getDisplayName(chairman.username),
        short_abbr: 'ПК',
        name: coopname,
        daysLeft: String(Math.max(0, Math.floor(left / 86400))),
        expiresAt: own.expires_at.replace('T', ' '),
      };

      await this.notificationPort.notify({
        coopname,
        workflowId: Workflows.EndorsementExpiring.id,
        to: { subscriberId: chairman.subscriberId, email: chairman.email, username: chairman.username },
        payload,
      });

      this.logger.log(
        `Председатель предупреждён: заверение ${coopname} истекает через ${payload.daysLeft} дн.`,
        'EndorsementService',
      );
      return { warned: true };
    } catch (e) {
      this.logger.warn(
        `Предупреждение об истечении заверения не отправлено: ${e instanceof Error ? e.message : String(e)}`,
        'EndorsementService',
      );
      return { warned: false };
    }
  }

  /** Председатель установки — единственный адресат: решать тут больше некому. */
  private async resolveChairman(): Promise<{ username: string; subscriberId: string; email?: string } | null> {
    const found = await this.accountPort.getAccounts({ role: 'chairman' }, { page: 1, limit: 1, sortOrder: 'ASC' });
    const chairman = found.items?.[0];
    const subscriberId = chairman?.provider_account?.subscriber_id?.trim();
    if (!chairman || !subscriberId) {
      this.logger.warn('Председатель не найден — предупреждать об истечении заверения некого', 'EndorsementService');
      return null;
    }
    return { username: chairman.username, subscriberId, email: chairman.provider_account?.email };
  }

  /**
   * Подписывает заверение и кладёт его в цепь.
   *
   * Подписанное заверение хранится целиком: проверка удостоверения должна работать
   * без сети, значит подписи всей цепочки едут внутри удостоверения — а подпись под
   * заверением кооператива ставил не он сам, и взять её ему больше неоткуда.
   */
  private async issue(params: {
    issuer: string;
    issuerKey: string;
    subject: string;
    subjectKey: string;
    lifetimeSeconds: number;
    signer?: string;
  }): Promise<EndorsementRecord> {
    const chainId = (await this.blockchainPort.getInfo()).chain_id;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + params.lifetimeSeconds;

    const credential = await new SignJWT({ chain_id: chainId, cert: params.subjectKey })
      .setProtectedHeader({ alg: 'ES256K', typ: ENDORSEMENT_TYP, kid: params.issuerKey })
      .setIssuer(params.issuer)
      .setSubject(params.subject)
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .sign(await this.certKeyService.getSigningKeyFor(params.issuer));

    const record: EndorsementRecord = {
      issuer: params.issuer,
      subject: params.subject,
      chain_id: chainId,
      cert_key: params.subjectKey,
      // Цепь хранит время без часового пояса и понимает его как всемирное.
      expires_at: new Date(expiresAt * 1000).toISOString().slice(0, 19),
      credential,
    };

    await this.blockchainPort.publishEndorsement(record, params.signer);
    return record;
  }

  /**
   * Годится ли имеющееся заверение. Не годится, если признан другой ключ — значит
   * ключ заверения сменился, и старое признание к нему не относится, — либо если
   * до истечения осталось меньше, чем нужно на спокойное продление.
   */
  private isFresh(endorsement: EndorsementRecord, expectedKey: string, renewBeforeSeconds: number): boolean {
    if (this.crypto.normalizePublicKey(endorsement.cert_key) !== this.crypto.normalizePublicKey(expectedKey))
      return false;
    return this.secondsLeft(endorsement) > renewBeforeSeconds;
  }

  /** Сколько заверению осталось действовать. Цепь хранит время как всемирное. */
  private secondsLeft(endorsement: EndorsementRecord): number {
    const expiresAt = Math.floor(new Date(`${endorsement.expires_at}Z`).getTime() / 1000);
    return expiresAt - Math.floor(Date.now() / 1000);
  }
}
