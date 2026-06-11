import { createPrivateKey, randomUUID, type KeyObject } from 'node:crypto';
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

/** Звенья cert-цепи доверия CoopID (миграция 052): ano → voskhod → vostok. */
const CERT_CHAIN_ACCOUNTS = ['ano', 'voskhod', 'vostok'] as const;
const CLAIM_SCHEMA_VERSION = '1';
/** Срок жизни сертификата. Технический дефолт (24ч) — уточняется продуктовой политикой. */
const CERTIFICATE_TTL = '24h';
/** Лимит размера JWS — Vision/MIFARE DESFire EV3 (AC Story 1.8). */
const MAX_CERT_BYTES = 5 * 1024;

export interface CoopChainLink {
  account: string;
  public_key: string;
}

/**
 * Выпуск participant_certificate (CoopID, Story 1.8): compact JWS alg=ES256K,
 * подписанный ключом permission `cert` аккаунта vostok (PEM из Docker Secret
 * `coop_cert_key`). Сертификат самодостаточен — несёт цепь доверия `coop_chain`
 * [ano,voskhod,vostok] для offline-верификации от вшитого trust anchor (ano).
 * Подпись ES256K через jose + Node KeyObject — wharfkit в application не нужен.
 */
@Injectable()
export class CertificateService {
  private signingKey: KeyObject | null = null;
  private coopChain: CoopChainLink[] | null = null;

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
    @Inject(USER_CERTIFICATE_DOMAIN_SERVICE) private readonly certDomainService: UserCertificateDomainService,
    private readonly verificationTypesService: VerificationTypesService,
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
    const vostokKey = coopChain[coopChain.length - 1]?.public_key;
    // Типы верификации выводятся из реального членства (Story 4.1). В claim идёт
    // структурная форма {type, verified_at, source} (Story 4.3) — без status (форма AC,
    // экономия байт под лимит 5 КБ). RP получает её через OIDC userinfo в Epic 5.
    const verificationTypes = await this.verificationTypesService.resolveForUsername(username, coopname);

    const jws = await new SignJWT({
      coopname,
      coop_chain: coopChain,
      verification_types: verificationTypes.map((entry) => ({
        type: entry.type,
        verified_at: entry.verified_at,
        source: entry.source,
      })),
      identification: identification ?? null,
      claim_schema_version: CLAIM_SCHEMA_VERSION,
    })
      .setProtectedHeader({ alg: 'ES256K', typ: 'JWT', kid: vostokKey })
      .setIssuer(`https://${coopname}.coop`)
      .setSubject(user.id)
      .setJti(randomUUID()) // серийный номер удостоверения (ЛК показывает его, Story 1.9)
      .setIssuedAt()
      .setExpirationTime(CERTIFICATE_TTL)
      .sign(this.getSigningKey());

    const size = Buffer.byteLength(jws, 'utf8');
    if (size > MAX_CERT_BYTES)
      throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, `participant_certificate превышает ${MAX_CERT_BYTES} байт (${size})`);

    return jws;
  }

  private async resolveIdentification(username: string): Promise<UserCertificateDomainInterface | null> {
    const account = await this.accountDomainService.getPrivateAccount(username);
    return this.certDomainService.createCertificateFromUserData(account);
  }

  /** PEM cert-ключа → Node KeyObject (ES256K). Кэшируется на жизнь процесса. */
  private getSigningKey(): KeyObject {
    if (this.signingKey) return this.signingKey;
    const pem = config.authV2.certKey;
    if (!pem)
      throw new Error('COOP_CERT_KEY(_FILE) не сконфигурирован: невозможно подписать participant_certificate');
    this.signingKey = createPrivateKey(pem);
    return this.signingKey;
  }

  /**
   * Цепь cert-ключей [ano,voskhod,vostok] из COOPOS. Кэшируется (ключи cert
   * меняются крайне редко; ротация — рестарт/инвалидция в будущих историях).
   */
  private async getCoopChain(): Promise<CoopChainLink[]> {
    if (this.coopChain) return this.coopChain;
    const links: CoopChainLink[] = [];
    for (const account of CERT_CHAIN_ACCOUNTS) {
      let key: string | null;
      try {
        key = await this.blockchainPort.getCertPublicKey(account);
      } catch {
        throw new AuthV2Error(AuthV2ErrorCode.CooposDegraded, `COOPOS недоступен: cert-ключ ${account} не получен`);
      }
      if (!key)
        throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, `cert-permission аккаунта ${account} отсутствует или не single-key`);
      links.push({ account, public_key: key });
    }
    this.coopChain = links;
    return links;
  }
}
