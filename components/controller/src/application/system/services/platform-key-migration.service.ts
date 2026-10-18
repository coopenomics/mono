import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { SystemStatus } from '~/application/system/dto/system-status.dto';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { MONO_STATUS_REPOSITORY, type MonoStatusRepository } from '~/domain/common/repositories/mono-status.repository';

/**
 * Самомиграция ключа узла (registrator::setplatform).
 *
 * Установленный узел подписывает транзакции кооператива активным ключом из
 * своего хранилища. Этот ключ — ключ пайщика-кооператива: смена ключа при
 * восстановлении доступа или переходе на пароль меняет active, и узел терял бы
 * право подписи. При старте узел закрепляет свой ключ разрешением platform:
 * active = {ключ, <кооператив>@platform}, и смена ключа пайщика узел больше не
 * останавливает. Узел, включённый после долгого простоя, мигрирует тем же путём.
 *
 * Запуск не задерживается: сбой цепи на старте — повод повторить при следующем
 * старте, а не причина не подняться.
 */
@Injectable()
export class PlatformKeyMigrationService implements OnApplicationBootstrap {
  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(BLOCKCHAIN_PORT) private readonly blockchain: BlockchainPort,
    @Inject(MONO_STATUS_REPOSITORY) private readonly monoStatus: MonoStatusRepository
  ) {
    this.logger.setContext(PlatformKeyMigrationService.name);
  }

  onApplicationBootstrap(): void {
    void this.migrate();
  }

  async migrate(): Promise<void> {
    try {
      const mono = await this.monoStatus.getMonoDocument();
      if (mono?.status !== SystemStatus.active) return;
      const result = await this.blockchain.ensureOwnPlatformKey();
      if (result === 'issued') this.logger.info('Ключ узла закреплён разрешением platform');
      if (result === 'key-not-active')
        this.logger.warn(
          'Ключ узла больше не подписывает как active: ключ пайщика сменили без закрепления. Нужен новый ключ установки со страницы подключения'
        );
      if (result === 'shared-active')
        this.logger.warn('Ключ узла не закреплён: в active несколько ключей, закрепление требует участия пайщика');
    } catch (error: any) {
      this.logger.warn(`Самомиграция ключа узла не выполнена, повтор при следующем старте: ${error?.message ?? error}`);
    }
  }
}
