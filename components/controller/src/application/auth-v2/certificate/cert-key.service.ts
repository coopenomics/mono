import type { KeyObject } from 'node:crypto';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { CERT_KEY_CRYPTO_PORT } from '~/domain/auth-v2/ports/cert-key-crypto.port';
import type { ICertKeyCrypto } from '~/domain/auth-v2/ports/cert-key-crypto.port';
import { VAULT_DOMAIN_SERVICE, VaultDomainService } from '~/domain/vault/services/vault-domain.service';
import { wifPermissions } from '~/domain/vault/types/vault.types';

/**
 * Аккаунт АНО — якорь доверия всей сети: он заверяет кооперативы, а те заверяют
 * пайщиков. Пока его нет в цепи, удостоверения укореняются на самом кооперативе.
 */
const TRUST_ANCHOR_ACCOUNT = 'ano';

/**
 * Кооператив, который ведёт аккаунт АНО. Имя задано прямо здесь намеренно: якорь
 * доверия сети один, и подменять его настройкой конкретной установки нельзя —
 * иначе любой кооператив объявит себя якорем и станет заверять сам себя.
 * Остальные кооперативы заверяют только себя.
 */
const TRUST_ANCHOR_STEWARD = 'voskhod';

/**
 * Ключ, которым кооператив заверяет удостоверения пайщиков: выпуск, хранение и
 * публикация публичной части в цепи.
 *
 * Почему это делает сервер, а не человек. Право заверения — разовая криптографическая
 * настройка, без которой удостоверения просто не выпускаются. Ждать, что председатель
 * кооператива зайдёт на страницу и нажмёт кнопку, бессмысленно: он о существовании
 * такой кнопки не узнает, а кооператив всё это время будет работать без удостоверений.
 * Поэтому при старте приложение само доводит настройку до рабочего состояния и молчит,
 * если всё уже в порядке.
 *
 * Где лежит ключ. Приоритет у секрета поставки (`COOP_CERT_KEY`/`_FILE`) — там его
 * можно завести заранее и хранить вне базы. Если секрета нет, ключ выпускается сам и
 * ложится в то же хранилище, где лежит ключ кооператива, отдельным правом. Наружу
 * приватная часть не отдаётся никогда.
 */
@Injectable()
export class CertKeyService implements OnApplicationBootstrap {
  /** Разобранный ключ подписи; кэшируется на жизнь процесса (перевыпуск сбрасывает). */
  private signingKey: KeyObject | null = null;

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vault: VaultDomainService,
    @Inject(CERT_KEY_CRYPTO_PORT) private readonly crypto: ICertKeyCrypto,
    private readonly logger: WinstonLoggerService,
  ) {}

  /**
   * Довести право заверения до рабочего состояния при старте. Ошибки не роняют
   * приложение: без удостоверений кооператив работает, просто карточка в кабинете
   * останется пустой — а вот упавший из-за криптографии бэкенд не работает совсем.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensurePublished();
      await this.ensureAnchorPublished();
    } catch (e) {
      this.logger.warn(
        `Право заверения удостоверений не настроено: ${e instanceof Error ? e.message : String(e)}. Удостоверения выпускаться не будут.`,
        'CertKeyService',
      );
    }
  }

  /**
   * Проверяет, что в цепи опубликован публичный ключ того же ключа заверения, что
   * держит приложение, и приводит цепь в соответствие, если это не так. Ключа нет
   * вовсе — выпускает.
   *
   * Идемпотентно: при совпадении не делает ни одной записи в цепь.
   */
  async ensurePublished(): Promise<{ published: boolean; publicKey: string }> {
    const coopname = config.coopname;
    const wif = (await this.loadStoredKey()) ?? (await this.issueAndStore());
    const publicKey = this.crypto.publicKeyOf(wif);

    const onChain = await this.blockchainPort.getCertPublicKey(coopname);
    if (onChain && this.crypto.normalizePublicKey(onChain) === this.crypto.normalizePublicKey(publicKey)) {
      return { published: false, publicKey };
    }

    await this.blockchainPort.publishCertPermission(coopname, publicKey);
    this.logger.log(`Опубликовано право заверения кооператива ${coopname}`, 'CertKeyService');
    return { published: true, publicKey };
  }

  /**
   * Доводит до рабочего состояния право заверения АНО — но только у кооператива,
   * который её ведёт, и только когда цепь это подтверждает.
   *
   * Три условия, и все обязательны: установка принадлежит ведущему кооперативу,
   * аккаунт АНО заведён в цепи, и распорядительные права на него переданы этому
   * кооперативу по имени. Не выполнено любое — тихо выходим: это не сбой, а «ещё
   * не завели». Как только аккаунт появится и права передадут, ближайший запуск
   * доделает остальное сам.
   *
   * Зачем вообще: без якоря цепь доверия состоит из одного звена, и кооператив
   * подтверждает сам себя. С якорем проверяющий укореняется на АНО, и чужой
   * кооператив себя уже не подтвердит.
   */
  async ensureAnchorPublished(): Promise<{ published: boolean; publicKey?: string }> {
    if (config.coopname !== TRUST_ANCHOR_STEWARD) return { published: false };

    const account = await this.blockchainPort.getAccount(TRUST_ANCHOR_ACCOUNT);
    if (!account) {
      this.logger.log(`Аккаунт ${TRUST_ANCHOR_ACCOUNT} в цепи не заведён — якорь доверия пока не подключаем`, 'CertKeyService');
      return { published: false };
    }

    const canManage = await this.blockchainPort.canManageAccount(TRUST_ANCHOR_ACCOUNT, config.coopname);
    if (!canManage) {
      this.logger.warn(
        `Аккаунт ${TRUST_ANCHOR_ACCOUNT} есть в цепи, но распорядительные права на него не переданы ${config.coopname} — право заверения якоря не публикуем`,
        'CertKeyService',
      );
      return { published: false };
    }

    const wif = (await this.vault.getWif(TRUST_ANCHOR_ACCOUNT, wifPermissions.Cert)) ?? (await this.issueAndStore(TRUST_ANCHOR_ACCOUNT));
    const publicKey = this.crypto.publicKeyOf(wif);

    const onChain = await this.blockchainPort.getCertPublicKey(TRUST_ANCHOR_ACCOUNT);
    if (onChain && this.crypto.normalizePublicKey(onChain) === this.crypto.normalizePublicKey(publicKey)) {
      return { published: false, publicKey };
    }

    // Подписывает кооператив своим ключом; полномочие указывается от имени АНО —
    // цепь принимает подпись по переданным правам.
    await this.blockchainPort.publishCertPermission(TRUST_ANCHOR_ACCOUNT, publicKey, config.coopname);
    this.logger.log(`Опубликовано право заверения якоря ${TRUST_ANCHOR_ACCOUNT}`, 'CertKeyService');
    return { published: true, publicKey };
  }

  /**
   * Перевыпуск: новый ключ вместо прежнего, публикация в цепь. Прежние удостоверения
   * после этого не проверяются — их подпись сделана ключом, которого в цепи больше нет.
   * Поэтому перевыпуск — действие на случай компрометации, а не рутина.
   *
   * Работает только с собственным ключом: если ключ задан секретом поставки, менять
   * его должен тот, кто этим секретом управляет.
   */
  async reissue(): Promise<{ publicKey: string }> {
    if (config.authV2.certKey) {
      throw new Error(
        'Ключ заверения задан секретом поставки — перевыпустить его можно только там, где этот секрет заводится',
      );
    }
    const wif = await this.issueAndStore();
    const publicKey = this.crypto.publicKeyOf(wif);
    await this.blockchainPort.publishCertPermission(config.coopname, publicKey);
    this.signingKey = null;
    this.logger.warn(`Ключ заверения кооператива ${config.coopname} перевыпущен: ранее выданные удостоверения больше не проверяются`, 'CertKeyService');
    return { publicKey };
  }

  /** Ключ подписи удостоверений для `CertificateService`. Бросает, если ключа нет. */
  async getSigningKey(): Promise<KeyObject> {
    if (this.signingKey) return this.signingKey;

    const wif = await this.loadStoredKey();
    if (!wif)
      throw new Error('Ключ заверения не найден: ни секрета поставки, ни собственного выпуска');
    this.signingKey = this.crypto.toSigningKey(wif);
    return this.signingKey;
  }

  /** Публичная часть ключа заверения — для витрины в кабинете. `null`, если ключа нет. */
  async publicKey(): Promise<string | null> {
    const wif = await this.loadStoredKey();
    return wif ? this.crypto.publicKeyOf(wif) : null;
  }

  /** Текущий ключ в виде WIF: секрет поставки либо собственный выпуск. `null` — нет ни того, ни другого. */
  private async loadStoredKey(): Promise<string | null> {
    const pem = config.authV2.certKey;
    if (pem) return this.crypto.pemToChainKey(pem);
    return this.vault.getWif(config.coopname, wifPermissions.Cert);
  }

  /** Выпускает новый ключ и кладёт его в хранилище рядом с ключом кооператива. */
  private async issueAndStore(account: string = config.coopname): Promise<string> {
    const wif = this.crypto.generate();
    const saved = await this.vault.setWif({
      username: account,
      wif,
      permission: wifPermissions.Cert,
    });
    if (!saved) throw new Error('Не удалось сохранить ключ заверения');
    this.signingKey = null;
    return wif;
  }
}
