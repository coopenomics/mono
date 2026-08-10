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

/** Лимит размера JWS — Vision/MIFARE DESFire EV3 (AC Story 1.8). */
const MAX_CERT_BYTES = 5 * 1024;

export interface CoopChainLink {
  account: string;
  public_key: string;
}

/**
 * Выпуск participant_certificate (CoopID, Story 1.8): compact JWS alg=ES256K,
 * подписанный ключом права `cert` самого кооператива (секрет поставки либо
 * собственный выпуск, см. CertKeyService). Сертификат самодостаточен — несёт цепь доверия `coop_chain`
 * (якорь → кооператив) для offline-верификации.
 * Подпись ES256K через jose + Node KeyObject — wharfkit в application не нужен.
 */
@Injectable()
export class CertificateService {
  private coopChain: CoopChainLink[] | null = null;

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
    const coopChain = await this.getCoopChain();
    // Подписывает последнее звено цепи — сам кооператив; его ключ и уходит в `kid`.
    const signingPublicKey = coopChain[coopChain.length - 1]?.public_key;
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
      coop_chain: coopChain,
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
   * Цепь ключей заверения из COOPOS: якорь (если он есть) → кооператив, чьим ключом
   * удостоверение и подписывается. Кэшируется (ключи заверения меняются крайне
   * редко; ротация — рестарт/инвалидация в будущих историях).
   *
   * Раньше цепь была константой `[ano, voskhod, vostok]`. Это было неверно дважды:
   * имя кооператива оказалось вшито в код (у любого другого кооператива цепь
   * указывала бы на чужой), а `vostok` в ней был лишним звеном. Теперь кооператив
   * берётся из настроек, а якорь подключается сам, как только появится в цепи.
   */
  private async getCoopChain(): Promise<CoopChainLink[]> {
    if (this.coopChain) return this.coopChain;

    const links: CoopChainLink[] = [];
    const anchorKey = await this.certKey(TRUST_ANCHOR_ACCOUNT);
    if (anchorKey) links.push({ account: TRUST_ANCHOR_ACCOUNT, public_key: anchorKey });

    // Кооператив — звено обязательное: именно его ключом подписан сертификат, и без
    // публикации соответствующего публичного ключа проверить подпись невозможно.
    const coopname = config.coopname;
    const coopKey = await this.certKey(coopname);
    if (!coopKey)
      throw new AuthV2Error(
        AuthV2ErrorCode.ChainVerificationFailed,
        `у кооператива ${coopname} нет права заверения (permission «cert» с одним ключом) — удостоверение выпустить нечем`,
      );
    links.push({ account: coopname, public_key: coopKey });

    this.coopChain = links;
    return links;
  }

  /** Публичный ключ заверения аккаунта; `null` — права нет. Недоступность цепи — отдельная ошибка. */
  private async certKey(account: string): Promise<string | null> {
    try {
      return await this.blockchainPort.getCertPublicKey(account);
    } catch {
      throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, `COOPOS недоступен: ключ заверения ${account} не получен`);
    }
  }
}
