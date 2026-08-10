import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { SignJWT } from 'jose';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort, EndorsementRecord } from '~/domain/common/ports/blockchain.port';
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
 * а не расписание, и автоматики под него нет намеренно. Продление обслуживаемым
 * кооперативам ждёт ответа на вопрос, откуда оператор берёт их список: реестра
 * обслуживаемых установок в кабинете нет, и додумывать его нельзя.
 */
@Injectable()
export class EndorsementService implements OnApplicationBootstrap {
  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    private readonly certKeyService: CertKeyService,
    @Inject(CERT_KEY_CRYPTO_PORT) private readonly crypto: ICertKeyCrypto,
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
    if (existing && this.isFresh(existing, operatorKey)) return { issued: false };

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
  private isFresh(endorsement: EndorsementRecord, expectedKey: string): boolean {
    if (this.crypto.normalizePublicKey(endorsement.cert_key) !== this.crypto.normalizePublicKey(expectedKey))
      return false;
    const expiresAt = Math.floor(new Date(`${endorsement.expires_at}Z`).getTime() / 1000);
    return expiresAt - Math.floor(Date.now() / 1000) > RENEW_BEFORE_SECONDS;
  }
}
