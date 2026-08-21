import { randomUUID, type KeyObject } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import config from '~/config/config';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import { ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import type { AccountDomainService } from '~/domain/account/services/account-domain.service';
import { USER_CERTIFICATE_DOMAIN_SERVICE } from '~/domain/user/services/user-certificate-domain.service';
import type { UserCertificateDomainService } from '~/domain/user/services/user-certificate-domain.service';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { VerificationTypesService } from '~/application/auth-v2/verification/verification-types.service';
import { CertSettingsService } from '~/application/auth-v2/certificate/cert-settings.service';
import { CertKeyService, TRUST_ANCHOR_ACCOUNT } from '~/application/auth-v2/certificate/cert-key.service';
import { DATA_RETENTION_CONTRACT, RETENTION_PERIOD_SECONDS } from '~/application/auth-v2/certificate/retention-policy';
import { CURRENT_SCHEMA_VERSION } from '~/application/auth-v2/certificate/schema-policy';

/**
 * Насколько долго держится цепочка заверений, прочитанная из цепи. Заверения
 * меняются раз в месяц, а удостоверение выпускается при каждом открытии страницы.
 */
const TRUST_CHAIN_CACHE_MS = 5 * 60 * 1000;

/**
 * Предел длины цепочки. Уровней всего три, и запас нужен не под рост, а против
 * замкнутого круга в записях: без него обход зациклился бы.
 */
const MAX_TRUST_CHAIN_DEPTH = 5;

/** Лимит размера JWS — Vision/MIFARE DESFire EV3 (AC Story 1.8). */
const MAX_CERT_BYTES = 5 * 1024;

/**
 * Выпуск participant_certificate (CoopID, Story 1.8): compact JWS alg=ES256K,
 * подписанный ключом права `cert` самого кооператива (секрет поставки либо
 * собственный выпуск, см. CertKeyService). Сертификат самодостаточен — несёт цепь доверия `coop_chain`
 * (якорь → кооператив) для offline-верификации.
 * Подпись ES256K через jose + Node KeyObject — wharfkit в application не нужен.
 */
@Injectable()
export class CertificateService {
  /**
   * Цепочка заверений с отметкой времени. Кэшируется ненадолго: заверения меняются
   * раз в месяц, а удостоверение выпускается при каждом открытии страницы, и
   * ходить за ними в цепь каждый раз — лишняя задержка на самом видном экране.
   * Держать же их вечно нельзя: продлённое заверение должно доехать до пайщика.
   */
  private trustChain: { links: string[]; fetchedAt: number } | null = null;

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
    @Inject(USER_CERTIFICATE_DOMAIN_SERVICE) private readonly certDomainService: UserCertificateDomainService,
    private readonly verificationTypesService: VerificationTypesService,
    private readonly certSettingsService: CertSettingsService,
    private readonly certKeyService: CertKeyService,
  ) {}

  /**
   * Выпустить сертификат для пайщика по имени блокчейн-аккаунта (username = sub
   * второго этапа auth). `sub` сертификата — UUID пайщика (user.id), не аккаунт.
   */
  async issueForUsername(username: string): Promise<string> {
    const user = await this.userDomainService.getUserByUsername(username);
    const identification = await this.resolveIdentification(username);
    const coopname = config.coopname;
    const trustChain = await this.getTrustChain();
    // Подписывает сам кооператив. Ключ уходит в `kid` справочно: проверяющий берёт
    // его из последнего заверения, а не отсюда — иначе предъявитель называл бы ключ,
    // которым его же и проверяют.
    const signingPublicKey = (await this.certKeyService.publicKey()) ?? undefined;
    // Типы верификации выводятся из реального членства (Story 4.1). В claim идёт
    // структурная форма {type, verified_at, source} (Story 4.3) — без status (форма AC,
    // экономия байт под лимит 5 КБ). RP получает её через OIDC userinfo в Epic 5.
    const verificationTypes = await this.verificationTypesService.resolveForUsername(username, coopname);

    // Срок жизни — продуктовая настройка кооператива (Story 4.6): короткий TTL (дефолт 1ч)
    // ограничивает окно атаки при компрометации ключа. iat/exp выставляем явно.
    const ttlSeconds = await this.certSettingsService.getCertTtlSeconds();
    const nowSeconds = Math.floor(Date.now() / 1000);

    const jws = await new SignJWT({
      coopname,
      trust_chain: trustChain,
      verification_types: verificationTypes.map((entry) => ({
        type: entry.type,
        verified_at: entry.verified_at,
        source: entry.source,
      })),
      identification: identification ?? null,
      claim_schema_version: CURRENT_SCHEMA_VERSION,
      // 152-ФЗ-обязательство RP (Story 4.8): удалить данные при исключении и не позже дедлайна.
      // Дедлайн привязан к моменту выпуска (тот же nowSeconds, что у iat/exp).
      data_retention_contract: DATA_RETENTION_CONTRACT,
      retention_deadline_ts: nowSeconds + RETENTION_PERIOD_SECONDS,
    })
      .setProtectedHeader({ alg: 'ES256K', typ: 'JWT', kid: signingPublicKey })
      .setIssuer(`https://${coopname}.coop`)
      .setSubject(user.id)
      .setJti(randomUUID()) // серийный номер удостоверения (ЛК показывает его, Story 1.9)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + ttlSeconds)
      .sign(await this.getSigningKey());

    const size = Buffer.byteLength(jws, 'utf8');
    if (size > MAX_CERT_BYTES)
      throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, `participant_certificate превышает ${MAX_CERT_BYTES} байт (${size})`);

    return jws;
  }

  private async resolveIdentification(username: string): Promise<UserCertificateDomainInterface | null> {
    const account = await this.accountDomainService.getPrivateAccount(username);
    return this.certDomainService.createCertificateFromUserData(account);
  }

  /**
   * Ключ подписи удостоверений. Живёт в `CertKeyService` — он же его и выпускает,
   * если ключа ещё нет: раньше ключ приходил только секретом поставки, а при его
   * отсутствии удостоверения просто не выпускались и никто об этом не узнавал.
   */
  private getSigningKey(): Promise<KeyObject> {
    return this.certKeyService.getSigningKey();
  }

  /**
   * Цепочка заверений от корня к кооперативу — подписанные заверения целиком, по
   * порядку. Именно она едет внутри удостоверения и позволяет проверить его без
   * сети.
   *
   * Раньше здесь собирался перечень имён и ключей. Он ничего не доказывал:
   * проверяющему приходилось лезть в цепь за ключами по именам, взятым из самого
   * предъявленного удостоверения, — а значит любой кооператив мог поставить корень
   * первым звеном, ключи-то настоящие. Подпись под заверением закрывает это: имя
   * больше ничего не решает.
   *
   * Пустая цепочка — не ошибка. Кооператив, которого ещё никто не заверил,
   * удостоверения выпускает, но проверку они не проходят, и пайщику это видно.
   * Отказать было бы хуже: пайщик не виноват, что кооператив выпал из цепочки.
   */
  private async getTrustChain(): Promise<string[]> {
    const cached = this.trustChain;
    if (cached && Date.now() - cached.fetchedAt < TRUST_CHAIN_CACHE_MS) return cached.links;

    const links: string[] = [];
    let subject: string | null = config.coopname;

    // Идём снизу вверх и разворачиваем: у записи есть ссылка на заверяющего, но не
    // на заверённых, а проверяющему цепочка нужна от корня.
    for (let depth = 0; subject && depth < MAX_TRUST_CHAIN_DEPTH; depth++) {
      const endorsement = await this.endorsementOf(subject);
      if (!endorsement) break;
      links.unshift(endorsement.credential);
      subject = endorsement.issuer === TRUST_ANCHOR_ACCOUNT ? null : endorsement.issuer;
    }

    this.trustChain = { links, fetchedAt: Date.now() };
    return links;
  }

  /** Заверение субъекта из цепи. Недоступность цепи — отдельная ошибка, не «нет заверения». */
  private async endorsementOf(subject: string) {
    try {
      return await this.blockchainPort.getEndorsement(subject);
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, `COOPOS недоступен: заверение ${subject} не получено`);
    }
  }

}
