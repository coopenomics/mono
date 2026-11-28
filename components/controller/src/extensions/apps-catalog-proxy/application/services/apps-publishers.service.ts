/**
 * Издатели приложений (487-27).
 *
 * Пайщик сам регистрирует новый пакет на себя и становится его издателем;
 * администратор (председатель) назначает издателя пакету, который уже есть в
 * каталоге, и снимает издателей. Издатель со своего стола выпускает и
 * отзывает ключи каталога на свой пакет и назначает пакету цену.
 * Все обращения к каталогу — tenant-JWT'ом кооператива через
 * {@link AppsCatalogHttpService}; mono здесь — фильтр «можно ли этому
 * аккаунту этот пакет».
 */
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { platformSettings, type TableStore } from '@coopenomics/extension-kit';
import { APPS_PUBLISHER_STORE } from '../../infrastructure/database/apps-catalog-proxy-stores';
import { AppsPublisherRecord } from '../../infrastructure/records/apps-publisher.record';
import { t } from '../../i18n';
import {
  AppsCatalogHttpService,
  type CreatePublisherTokenOutcome,
  type DeveloperPricingRow,
  type PublisherTokenWire,
  type SetDeveloperPricingOutcome,
} from '../../infrastructure/apps-catalog-http.service';
import { DeveloperLiveFeedService } from './developer-live-feed.service';

const PACKAGE_ID_RE = /^@[a-z0-9-]+\/[a-z0-9-]+$/;

@Injectable()
export class AppsPublishersService {
  private readonly logger = new Logger(AppsPublishersService.name);

  constructor(
    @Inject(APPS_PUBLISHER_STORE)
    private readonly store: TableStore<AppsPublisherRecord>,
    private readonly catalog: AppsCatalogHttpService,
    @Optional() private readonly live?: DeveloperLiveFeedService,
  ) {}

  private get coopname(): string {
    return platformSettings().coopname;
  }

  /** Все назначения кооператива (для председателя). */
  list(): Promise<AppsPublisherRecord[]> {
    return this.store.find({ coopname: this.coopname }, { order: { createdAt: 'DESC' } });
  }

  /** Пакеты, на которые назначен аккаунт (для самого издателя). */
  listFor(username: string): Promise<AppsPublisherRecord[]> {
    return this.store.find({ coopname: this.coopname, username }, { order: { createdAt: 'DESC' } });
  }

  /** Назначить издателя. Пакет обязан быть в scope кооператива. */
  async add(input: { username: string; packageId: string; addedBy: string }): Promise<AppsPublisherRecord> {
    this.assertOwnScope(input.packageId);
    const existing = await this.store.findOne({ coopname: this.coopname, username: input.username, packageId: input.packageId });
    if (existing) return existing;
    const saved = await this.store.insert({
      coopname: this.coopname,
      username: input.username,
      packageId: input.packageId,
      addedBy: input.addedBy,
    });
    this.logger.log(`publisher added: ${input.username} → ${input.packageId} by ${input.addedBy}`);
    await this.grantToAllPackageKeys(input.username, input.packageId);
    return saved;
  }

  /**
   * Пайщик регистрирует новый пакет на себя. Занятый пакет зарегистрировать
   * нельзя: иначе любой пайщик получил бы ключ выпуска чужого приложения.
   * Занят пакет с издателем и пакет, который уже есть в каталоге, — такому
   * пакету издателя назначает администратор.
   */
  async register(input: { username: string; packageId: string }): Promise<AppsPublisherRecord> {
    this.assertOwnScope(input.packageId);
    const holders = await this.store.find({ coopname: this.coopname, packageId: input.packageId });
    const mine = holders.find((h) => h.username === input.username);
    if (mine) return mine;
    if (holders.length > 0) {
      throw new ForbiddenException(t('appsCatalogProxy.publishers.packageTaken', { packageId: input.packageId }));
    }
    const published = await this.catalog.listDeveloperPricing();
    if (published.some((p) => p.packageId === input.packageId)) {
      throw new ForbiddenException(t('appsCatalogProxy.publishers.packagePublished', { packageId: input.packageId }));
    }
    const saved = await this.store.insert({
      coopname: this.coopname,
      username: input.username,
      packageId: input.packageId,
      addedBy: input.username,
    });
    this.logger.log(`package registered: ${input.packageId} by ${input.username}`);
    await this.grantToAllPackageKeys(input.username, input.packageId);
    return saved;
  }

  /**
   * Новый пакет издателя попадает в его ключи «на все пакеты» (487-37).
   * Отказ каталога назначение не отменяет: издатель выпустит ключ заново, в
   * журнале остаётся предупреждение.
   */
  private async grantToAllPackageKeys(username: string, packageId: string): Promise<void> {
    try {
      const granted = await this.catalog.grantPublisherPackage(username, packageId);
      if (granted > 0) {
        this.logger.log(`package ${packageId} added to ${granted} all-packages key(s) of ${username}`);
        await this.live?.keysChanged(username);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`package ${packageId} not added to all-packages keys of ${username}: ${msg}`);
    }
  }

  /**
   * Снять издателя: назначение удаляется, пакет снимается с его ключей в
   * каталоге; ключ, у которого не осталось пакетов, отзывается.
   */
  async remove(input: { username: string; packageId: string; removedBy: string }): Promise<boolean> {
    const row = await this.store.findOne({ coopname: this.coopname, username: input.username, packageId: input.packageId });
    if (!row) return false;
    const touched = await this.catalog.revokePublisherAccess(input.username, input.packageId);
    await this.store.delete({ id: row.id });
    if (touched > 0) await this.live?.keysChanged(input.username);
    this.logger.log(
      `publisher removed: ${input.username} → ${input.packageId} by ${input.removedBy} (keys touched: ${touched})`,
    );
    return true;
  }

  /** Пакет обязан входить в пространство имён своего кооператива. */
  private assertOwnScope(packageId: string): void {
    if (!PACKAGE_ID_RE.test(packageId) || !packageId.startsWith(`@${this.coopname}/`)) {
      throw new ForbiddenException(t('appsCatalogProxy.publishers.packageOutOfScope', { coopname: this.coopname }));
    }
  }

  /**
   * Цены пакетов издателя. Пакет без выпуска каталог отдаёт, если цену ему
   * назначили при регистрации (487-37): узел передаёт свои пакеты списком.
   */
  async myPricing(username: string): Promise<DeveloperPricingRow[]> {
    const mine = await this.listFor(username);
    if (mine.length === 0) return [];
    const allowed = new Set(mine.map((m) => m.packageId));
    const all = await this.catalog.listDeveloperPricing([...allowed]);
    return all.filter((p) => allowed.has(p.packageId));
  }

  /** Цены всех пакетов кооператива, включая зарегистрированные без выпуска. */
  async allPricing(): Promise<DeveloperPricingRow[]> {
    const registered = await this.list();
    return this.catalog.listDeveloperPricing([...new Set(registered.map((r) => r.packageId))]);
  }

  /**
   * Цену пакету назначает только его издатель: администратор каталога цену
   * чужого пакета не меняет (решение владельца 27.11.2026).
   */
  async setPricing(input: {
    username: string;
    packageId: string;
    rubPerMonth: number;
    trialDays: number;
  }): Promise<SetDeveloperPricingOutcome> {
    await this.assertAssigned(input.username, input.packageId);
    const outcome = await this.catalog.setDeveloperPricing({
      packageId: input.packageId,
      rubPerMonth: input.rubPerMonth,
      trialDays: input.trialDays,
    });
    if (outcome.status === 'applied') await this.live?.packageChanged(input.packageId);
    return outcome;
  }

  private async assertAssigned(username: string, packageId: string): Promise<void> {
    const row = await this.store.findOne({ coopname: this.coopname, username, packageId });
    if (!row) {
      throw new ForbiddenException(t('appsCatalogProxy.publishers.notAssigned', { username, packageId }));
    }
  }

  /**
   * Ключи издателя (без секретов). Ключ принадлежит пайщику, а не пакету
   * (487-37): список — по аккаунту.
   */
  async myTokens(username: string): Promise<PublisherTokenWire[]> {
    const all = await this.catalog.listPublisherTokens({ username });
    return all.filter((t) => t.username === username);
  }

  /**
   * Выпустить ключ на свои пакеты либо на все свои пакеты. Ключ «на все»
   * получает текущие пакеты издателя, новые узел добавит при назначении.
   * Plaintext возвращается один раз.
   */
  async issueToken(input: {
    username: string;
    packageIds: string[];
    allPackages: boolean;
    label: string;
    expiresInDays?: number;
  }): Promise<CreatePublisherTokenOutcome> {
    const mine = new Set((await this.listFor(input.username)).map((m) => m.packageId));
    const requested = [...new Set(input.packageIds)];
    for (const packageId of requested) {
      if (!mine.has(packageId)) {
        throw new ForbiddenException(t('appsCatalogProxy.publishers.notAssigned', { username: input.username, packageId }));
      }
    }
    const packageIds = input.allPackages ? [...mine] : requested;
    if (!input.allPackages && packageIds.length === 0) {
      throw new ForbiddenException(t('appsCatalogProxy.publishers.tokenNeedsPackages'));
    }
    const outcome = await this.catalog.createPublisherToken({
      username: input.username,
      packageIds,
      allPackages: input.allPackages,
      label: input.label,
      createdBy: input.username,
      expiresInDays: input.expiresInDays,
    });
    if (outcome.status === 'created') await this.live?.keysChanged(input.username);
    return outcome;
  }

  /** Отозвать свой ключ: проверяем, что ключ действительно этого издателя. */
  async revokeToken(username: string, id: string): Promise<boolean> {
    const mine = await this.myTokens(username);
    const target = mine.find((t) => t.id === id);
    if (!target) throw new NotFoundException(t('appsCatalogProxy.publishers.tokenNotFound'));
    const revoked = await this.catalog.revokePublisherToken(id);
    if (revoked) await this.live?.keysChanged(username);
    return revoked;
  }
}
