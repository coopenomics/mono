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
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

const PACKAGE_ID_RE = /^@[a-z0-9-]+\/[a-z0-9-]+$/;

@Injectable()
export class AppsPublishersService {
  private readonly logger = new Logger(AppsPublishersService.name);

  constructor(
    @Inject(APPS_PUBLISHER_STORE)
    private readonly store: TableStore<AppsPublisherRecord>,
    private readonly catalog: AppsCatalogHttpService,
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
    return saved;
  }

  /** Снять издателя: назначение удаляется, все его ключи на пакет отзываются в каталоге. */
  async remove(input: { username: string; packageId: string; removedBy: string }): Promise<boolean> {
    const row = await this.store.findOne({ coopname: this.coopname, username: input.username, packageId: input.packageId });
    if (!row) return false;
    const revoked = await this.catalog.revokePublisherAccess(input.username, input.packageId);
    await this.store.delete({ id: row.id });
    this.logger.log(
      `publisher removed: ${input.username} → ${input.packageId} by ${input.removedBy} (tokens revoked: ${revoked})`,
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
   * Цены пакетов издателя. Пакет без выпуска каталогу ещё неизвестен: строки
   * у него нет, цена назначается после первого выпуска.
   */
  async myPricing(username: string): Promise<DeveloperPricingRow[]> {
    const mine = await this.listFor(username);
    if (mine.length === 0) return [];
    const allowed = new Set(mine.map((m) => m.packageId));
    const all = await this.catalog.listDeveloperPricing();
    return all.filter((p) => allowed.has(p.packageId));
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
    return this.catalog.setDeveloperPricing({
      packageId: input.packageId,
      rubPerMonth: input.rubPerMonth,
      trialDays: input.trialDays,
    });
  }

  private async assertAssigned(username: string, packageId: string): Promise<void> {
    const row = await this.store.findOne({ coopname: this.coopname, username, packageId });
    if (!row) {
      throw new ForbiddenException(t('appsCatalogProxy.publishers.notAssigned', { username, packageId }));
    }
  }

  /** Ключи издателя на его пакеты (без секретов). */
  async myTokens(username: string): Promise<PublisherTokenWire[]> {
    const mine = await this.listFor(username);
    if (mine.length === 0) return [];
    const all = await this.catalog.listPublisherTokens({ username });
    const allowed = new Set(mine.map((m) => m.packageId));
    return all.filter((t) => allowed.has(t.package_id));
  }

  /** Выпустить ключ на свой пакет. Plaintext возвращается один раз. */
  async issueToken(input: {
    username: string;
    packageId: string;
    label: string;
    expiresInDays?: number;
  }): Promise<CreatePublisherTokenOutcome> {
    await this.assertAssigned(input.username, input.packageId);
    return this.catalog.createPublisherToken({
      username: input.username,
      packageId: input.packageId,
      label: input.label,
      createdBy: input.username,
      expiresInDays: input.expiresInDays,
    });
  }

  /** Отозвать свой ключ: проверяем, что ключ действительно этого издателя на его пакет. */
  async revokeToken(username: string, id: string): Promise<boolean> {
    const mine = await this.myTokens(username);
    const target = mine.find((t) => t.id === id);
    if (!target) throw new NotFoundException(t('appsCatalogProxy.publishers.tokenNotFound'));
    return this.catalog.revokePublisherToken(id);
  }
}
