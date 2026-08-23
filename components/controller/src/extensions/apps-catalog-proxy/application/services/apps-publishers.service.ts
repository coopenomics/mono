/**
 * Издатели приложений (487-27).
 *
 * Председатель назначает/снимает издателя («аккаунт → пакет»). Издатель
 * со своего стола сам выпускает и отзывает ключи каталога на свой пакет.
 * Все обращения к каталогу — tenant-JWT'ом кооператива через
 * {@link AppsCatalogHttpService}; mono здесь — фильтр «можно ли этому
 * аккаунту этот пакет».
 */
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { platformSettings } from '@coopenomics/extension-kit';
import { Repository } from 'typeorm';
import { AppsPublisherTypeormEntity } from '../../infrastructure/entities/apps-publisher.typeorm-entity';
import {
  AppsCatalogHttpService,
  type CreatePublisherTokenOutcome,
  type PublisherTokenWire,
} from '../../infrastructure/apps-catalog-http.service';

const PACKAGE_ID_RE = /^@[a-z0-9-]+\/[a-z0-9-]+$/;

@Injectable()
export class AppsPublishersService {
  private readonly logger = new Logger(AppsPublishersService.name);

  constructor(
    @InjectRepository(AppsPublisherTypeormEntity)
    private readonly repo: Repository<AppsPublisherTypeormEntity>,
    private readonly catalog: AppsCatalogHttpService,
  ) {}

  private get coopname(): string {
    return platformSettings().coopname;
  }

  /** Все назначения кооператива (для председателя). */
  list(): Promise<AppsPublisherTypeormEntity[]> {
    return this.repo.find({ where: { coopname: this.coopname }, order: { created_at: 'DESC' } });
  }

  /** Пакеты, на которые назначен аккаунт (для самого издателя). */
  listFor(username: string): Promise<AppsPublisherTypeormEntity[]> {
    return this.repo.find({
      where: { coopname: this.coopname, username },
      order: { created_at: 'DESC' },
    });
  }

  /** Назначить издателя. Пакет обязан быть в scope кооператива. */
  async add(input: { username: string; packageId: string; addedBy: string }): Promise<AppsPublisherTypeormEntity> {
    if (!PACKAGE_ID_RE.test(input.packageId) || !input.packageId.startsWith(`@${this.coopname}/`)) {
      throw new ForbiddenException(`Пакет должен быть в scope @${this.coopname}/`);
    }
    const existing = await this.repo.findOne({
      where: { coopname: this.coopname, username: input.username, package_id: input.packageId },
    });
    if (existing) return existing;
    const row = this.repo.create({
      coopname: this.coopname,
      username: input.username,
      package_id: input.packageId,
      added_by: input.addedBy,
    });
    const saved = await this.repo.save(row);
    this.logger.log(`publisher added: ${input.username} → ${input.packageId} by ${input.addedBy}`);
    return saved;
  }

  /** Снять издателя: назначение удаляется, все его ключи на пакет отзываются в каталоге. */
  async remove(input: { username: string; packageId: string; removedBy: string }): Promise<boolean> {
    const row = await this.repo.findOne({
      where: { coopname: this.coopname, username: input.username, package_id: input.packageId },
    });
    if (!row) return false;
    const revoked = await this.catalog.revokePublisherAccess(input.username, input.packageId);
    await this.repo.remove(row);
    this.logger.log(
      `publisher removed: ${input.username} → ${input.packageId} by ${input.removedBy} (tokens revoked: ${revoked})`,
    );
    return true;
  }

  private async assertAssigned(username: string, packageId: string): Promise<void> {
    const row = await this.repo.findOne({
      where: { coopname: this.coopname, username, package_id: packageId },
    });
    if (!row) {
      throw new ForbiddenException(`Аккаунт ${username} не назначен издателем пакета ${packageId}`);
    }
  }

  /** Ключи издателя на его пакеты (без секретов). */
  async myTokens(username: string): Promise<PublisherTokenWire[]> {
    const mine = await this.listFor(username);
    if (mine.length === 0) return [];
    const all = await this.catalog.listPublisherTokens({ username });
    const allowed = new Set(mine.map((m) => m.package_id));
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
    if (!target) throw new NotFoundException('Ключ не найден среди ваших');
    return this.catalog.revokePublisherToken(id);
  }
}
