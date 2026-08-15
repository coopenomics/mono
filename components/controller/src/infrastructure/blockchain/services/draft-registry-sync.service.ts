import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DraftContract } from 'cooptypes';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { TypeOrmDraftRegistryRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-draft-registry.repository';
import { ForkRegistryService } from '~/shared/sync/fork';
import type { IForkAwareSyncer } from '~/shared/sync/fork/fork-aware-syncer.interface';
import type { IDelta } from '~/types/common';

/**
 * Ведёт в базе узла историю реестра шаблонов документов и их переводов.
 *
 * Раньше эту роль исполнял обозреватель старого парсера: фабрика документов
 * ходила к нему по HTTP и спрашивала «шаблон номер N на блоке M». Сам реестр
 * общий для всей сети и живёт в скоупе контракта `draft`, поэтому обычная
 * проверка на принадлежность кооперативу его отбрасывает — исключение для этих
 * таблиц объявлено в delta-ownership.
 *
 * Каждая дельта добавляет версию, привязанную к номеру блока; ничего не
 * перезаписывается. При форке версии отменённых блоков снимаются — иначе
 * документ однажды соберётся по редакции, которой в цепи не было.
 */
@Injectable()
export class DraftRegistrySyncService implements OnModuleInit, IForkAwareSyncer {
  constructor(
    private readonly repository: TypeOrmDraftRegistryRepository,
    private readonly logger: WinstonLoggerService,
    private readonly forkRegistry: ForkRegistryService
  ) {
    this.logger.setContext(DraftRegistrySyncService.name);
  }

  onModuleInit() {
    this.forkRegistry.register(this);
  }

  /** Снимает версии отменённых блоков — контракт участника отката форка. */
  async handleFork(forkBlockNum: number): Promise<void> {
    const removed = await this.repository.deleteAfterBlock(forkBlockNum);
    if (removed > 0) {
      this.logger.log(`Реестр шаблонов: снято ${removed} версий из отменённых блоков > ${forkBlockNum}`);
    }
  }

  @OnEvent(`delta::${DraftContract.contractName.production}::${DraftContract.Tables.Drafts.tableName}`)
  async onTemplateDelta(delta: IDelta): Promise<void> {
    const registryId = delta.value?.registry_id;
    if (registryId === undefined || registryId === null) {
      // Строка без номера в реестре нечитаема для потребителя: искать её он
      // будет именно по этому номеру. Молча проглотить — значит потерять шаблон.
      this.logger.warn(`Дельта шаблона без registry_id (блок ${delta.block_num}) — версия не сохранена`);
      return;
    }

    await this.repository.saveTemplateVersion({
      registry_id: String(registryId),
      block_num: Number(delta.block_num),
      value: delta.value,
      present: delta.present !== false,
    });

    this.logger.log(`Шаблон ${registryId}: сохранена версия блока ${delta.block_num}`);
  }

  @OnEvent(`delta::${DraftContract.contractName.production}::${DraftContract.Tables.Translations.tableName}`)
  async onTranslationDelta(delta: IDelta): Promise<void> {
    const draftId = delta.value?.draft_id;
    const lang = delta.value?.lang;
    if (draftId === undefined || draftId === null || !lang) {
      this.logger.warn(`Дельта перевода без draft_id/lang (блок ${delta.block_num}) — версия не сохранена`);
      return;
    }

    await this.repository.saveTranslationVersion({
      draft_id: String(draftId),
      lang: String(lang),
      block_num: Number(delta.block_num),
      value: delta.value,
      present: delta.present !== false,
    });

    this.logger.log(`Перевод шаблона ${draftId} (${lang}): сохранена версия блока ${delta.block_num}`);
  }
}
