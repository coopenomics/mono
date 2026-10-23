import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { CERT_KEY_CRYPTO_PORT } from '~/domain/auth-v2/ports/cert-key-crypto.port';
import type { ICertKeyCrypto } from '~/domain/auth-v2/ports/cert-key-crypto.port';
import { VAULT_DOMAIN_SERVICE, VaultDomainService } from '~/domain/vault/services/vault-domain.service';
import { wifPermissions } from '~/domain/vault/types/vault.types';
import { COOP_KEY_INSTALLED_EVENT } from '~/domain/system/interfaces/coop-key-installed.event';

/** Имя разрешения аккаунта кооператива, по ключу которого каталог приложений узнаёт кооператив. */
export const CATALOG_PERMISSION = 'catalog';

/**
 * Ключ входа кооператива в каталог приложений (Архитектура v5 каталога, 487-34).
 *
 * Каталог узнаёт кооператив по подписи: сверяет её с единственным ключом
 * разрешения `<coop>@catalog` в цепи подсети кооператива. Разрешение дочернее к
 * `active` и не привязано ни к одному действию — транзакцию этим ключом не
 * подписать. Утечка ключа даёт только вход в каталог от имени кооператива и
 * закрывается перевыпуском.
 *
 * Ключ выпускает сам узел и хранит в том же хранилище, что и ключ кооператива,
 * отдельным правом `catalog`. В окружении ключа нет: раньше он задавался
 * переменной `CATALOG_SIGNING_KEY`, и открытая копия лежала в файлах поставки.
 *
 * Узел без каталога (`APPS_CATALOG_DELIVERY_URL` не задан) ключ не выпускает:
 * разрешение в цепи без пользы занимает память аккаунта.
 */
@Injectable()
export class CatalogKeyService implements OnApplicationBootstrap {
  /** Идущая публикация: два вызова в один момент отправили бы одну и ту же `updateauth`. */
  private publishing: Promise<{ published: boolean; publicKey: string }> | null = null;

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vault: VaultDomainService,
    @Inject(CERT_KEY_CRYPTO_PORT) private readonly crypto: ICertKeyCrypto,
    private readonly logger: WinstonLoggerService,
  ) {}

  /** Ошибка не роняет старт: без каталога кооператив работает, приложения просто не ставятся. */
  async onApplicationBootstrap(): Promise<void> {
    await this.publishSafely();
  }

  /**
   * Довести ключ каталога до рабочего состояния, не роняя вызывающего. Зовётся
   * при старте и после ввода ключа кооператива: узел, поднятый провайдером до
   * ввода ключа, при старте подписать `updateauth` нечем.
   */
  @OnEvent(COOP_KEY_INSTALLED_EVENT, { async: true })
  async publishSafely(): Promise<void> {
    if (!config.apps_catalog_auth.url) return;
    try {
      await this.ensurePublished();
    }
    catch (e) {
      this.logger.warn(
        `Ключ входа в каталог приложений не опубликован: ${e instanceof Error ? e.message : String(e)}. Приложения каталога не устанавливаются.`,
        'CatalogKeyService',
      );
    }
  }

  /**
   * В цепи стоит открытая часть того же ключа, что лежит в хранилище; ключа нет —
   * выпускается. Идемпотентно: при совпадении в цепь ничего не пишется.
   */
  ensurePublished(): Promise<{ published: boolean; publicKey: string }> {
    this.publishing ??= this.publish().finally(() => {
      this.publishing = null;
    });
    return this.publishing;
  }

  private async publish(): Promise<{ published: boolean; publicKey: string }> {
    const coopname = config.coopname;
    const wif = (await this.vault.getWif(coopname, wifPermissions.Catalog)) ?? (await this.issueAndStore(coopname));
    const publicKey = this.crypto.publicKeyOf(wif);

    if (await this.isOnChain(coopname, publicKey)) return { published: false, publicKey };

    try {
      await this.blockchainPort.publishPermission(coopname, CATALOG_PERMISSION, publicKey);
    }
    catch (e) {
      // Второй экземпляр контроллера мог опубликовать тот же ключ раньше:
      // цепь отвергает повтор, а нужное состояние уже есть.
      if (!(await this.isOnChain(coopname, publicKey))) throw e;
    }
    this.logger.log(`Опубликован ключ входа ${coopname}@${CATALOG_PERMISSION} в каталог приложений`, 'CatalogKeyService');
    return { published: true, publicKey };
  }

  private async isOnChain(coopname: string, publicKey: string): Promise<boolean> {
    const onChain = await this.blockchainPort.getPermissionPublicKey(coopname, CATALOG_PERMISSION);
    return !!onChain && this.crypto.normalizePublicKey(onChain) === this.crypto.normalizePublicKey(publicKey);
  }

  private async issueAndStore(coopname: string): Promise<string> {
    const wif = this.crypto.generate();
    const saved = await this.vault.setWif({ username: coopname, wif, permission: wifPermissions.Catalog });
    // i18n-ignore: причина отказа идёт только в журнал узла (publishSafely), до пайщика не доходит
    if (!saved) throw new Error('ключ входа в каталог не сохранён в хранилище');
    return wif;
  }
}
