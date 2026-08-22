import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { InvalidatedEntityRepository, InvalidatedEntityVersionRepository } from '@coopenomics/extension-kit/sync';
import config from '~/config/config';

/**
 * Story 4.4: фоновая очистка архивов invalidated_entities / invalidated_entity_versions.
 *
 * Логика retention:
 *  - LIB = chain.get_info().last_irreversible_block_num — авторитативный last irreversible
 *    block ноды (вариант C, без локальной эвристики «head − N»; точность важна потому что
 *    при глубоком форке архив — единственный источник восстановления, его срез до LIB
 *    означал бы потерю данных).
 *  - threshold = LIB - RETENTION_HORIZON_BLOCKS (1000 блоков запаса сверху). Хардкод,
 *    не env: окно отражает property сети EOSIO, не оператора. Перенастройка — отдельная
 *    Epic 9 story.
 *  - Удаляем WHERE invalidated_by_block < threshold. Архив со старшими блоками остаётся.
 *  - Если LIB ≤ RETENTION_HORIZON_BLOCKS (свежезапущенная testnet или ошибка ноды) —
 *    threshold ≤ 0, skip + log.
 *  - Cron-расписание: `BLOCKCHAIN_ARCHIVE_RETENTION_CRON` (default `0 * * * *` = ежечасно).
 *  - Глобальный выключатель: `BLOCKCHAIN_ARCHIVE_RETENTION_ENABLED` (default true).
 */
@Injectable()
export class BlockchainArchiveRetentionService {
  /**
   * Запас сверху над LIB. Срез ровно по LIB опасен — если нода ошибётся с LIB,
   * срежем потенциально нужное для восстановления. 1000 блоков (~8 минут на 0.5s блоке)
   * даёт буфер на любую BP-нелинейность irreversibility.
   */
  private static readonly RETENTION_HORIZON_BLOCKS = 1000;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly invalidatedEntityRepository: InvalidatedEntityRepository,
    private readonly invalidatedEntityVersionRepository: InvalidatedEntityVersionRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(BlockchainArchiveRetentionService.name);
  }

  @Cron(process.env.BLOCKCHAIN_ARCHIVE_RETENTION_CRON || '0 * * * *')
  async cleanup(): Promise<void> {
    if (!config.blockchain.archive_retention_enabled) {
      this.logger.debug('Archive retention disabled — skipping cleanup');
      return;
    }

    let lib: number;
    try {
      const info = await this.blockchainService.getInfo();
      lib = info.last_irreversible_block_num;
    } catch (e: any) {
      this.logger.warn(`Archive retention: не удалось получить LIB из chain.get_info — skip cleanup: ${e?.message}`);
      return;
    }

    const horizon = BlockchainArchiveRetentionService.RETENTION_HORIZON_BLOCKS;
    const threshold = lib - horizon;

    if (threshold <= 0) {
      this.logger.log(
        `Archive retention: LIB=${lib} ≤ horizon ${horizon} — нечего удалять (свежий chain)`
      );
      return;
    }

    const deletedEntities = await this.invalidatedEntityRepository.deleteOlderThan(threshold);
    const deletedVersions = await this.invalidatedEntityVersionRepository.deleteOlderThan(threshold);

    this.logger.log(
      `Archive retention: LIB=${lib}, threshold=${threshold} (LIB-${horizon}); удалено ${deletedEntities} invalidated_entities + ${deletedVersions} invalidated_entity_versions`
    );
  }
}
