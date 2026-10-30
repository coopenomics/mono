import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CapitalContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { ProgramPropertyStatus } from '../../domain/enums/program-property-status.enum';
import { AbstractEntitySyncService } from '@coopenomics/extension-kit/sync';
import { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import {
  ProgramPropertyRepository,
  PROGRAM_PROPERTY_REPOSITORY,
} from '../../domain/repositories/program-property.repository';
import { ProgramPropertyDeltaMapper } from '../../infrastructure/blockchain/mappers/program-property-delta.mapper';
import type { IProgramPropertyBlockchainData } from '../../domain/interfaces/program-property-blockchain.interface';

/**
 * Сервис синхронизации программных имущественных взносов с блокчейном
 *
 * Подписывается на дельты таблицы pgproperties контракта capital
 * и синхронизирует данные программных имущественных взносов в локальной базе данных
 */
@Injectable()
export class ProgramPropertySyncService
  extends AbstractEntitySyncService<ProgramPropertyDomainEntity, IProgramPropertyBlockchainData>
  implements OnModuleInit
{
  protected readonly entityName = 'ProgramProperty';

  constructor(
    @Inject(PROGRAM_PROPERTY_REPOSITORY)
    private readonly programPropertyRepository: ProgramPropertyRepository,
    programPropertyDeltaMapper: ProgramPropertyDeltaMapper,
    @Inject(LOGGER_PORT) logger: ILoggerPort,
    private readonly eventEmitter: EventEmitter2
  ) {
    super(programPropertyRepository, programPropertyDeltaMapper, logger);
  }

  async onModuleInit() {
    const supportedVersions = this.getSupportedVersions();
    this.logger.debug(
      `Сервис синхронизации программных имущественных взносов инициализирован. Поддерживаемые контракты: [${supportedVersions.contracts.join(
        ', '
      )}], таблицы: [${supportedVersions.tables.join(', ')}]`
    );

    // Программная подписка на все поддерживаемые паттерны событий
    const allPatterns = this.getAllEventPatterns();
    this.logger.debug(`Подписка на ${allPatterns.length} паттернов событий: ${allPatterns.join(', ')}`);

    // Подписываемся на каждый паттерн программно
    allPatterns.forEach((pattern) => {
      this.eventEmitter.on(pattern, this.processDelta.bind(this));
    });
  }

  /**
   * Имущество принято: председатель подтвердил одобрение акта, совет вызвал
   * act2pgprp. Строка в цепи стёрта, итог ставим по действию.
   */
  @OnEvent(`action::${CapitalContract.contractName.production}::${CapitalContract.Actions.Act2ProgramProperty.actionName}`)
  async handleAccepted(action: InnerChainActionRecord): Promise<void> {
    await this.markFinal(action, ProgramPropertyStatus.ACT2);
  }

  /**
   * Взнос отклонён председателем или советом на любом шаге — строка в цепи стёрта.
   */
  @OnEvent(`action::${CapitalContract.contractName.production}::${CapitalContract.Actions.DeclineProgramProperty.actionName}`)
  async handleDeclined(action: InnerChainActionRecord): Promise<void> {
    await this.markFinal(action, ProgramPropertyStatus.DECLINED);
  }

  private async markFinal(
    action: InnerChainActionRecord,
    status: ProgramPropertyStatus.ACT2 | ProgramPropertyStatus.DECLINED
  ): Promise<void> {
    // Уведомления получателям (require_recipient) приходят тем же именем — итог ставим один раз.
    if (action.receiver !== action.account) return;
    const hash = String(action.data?.property_hash ?? '').toLowerCase();
    if (!hash) return;
    try {
      const property = await this.programPropertyRepository.findBySyncKey('property_hash', hash);
      if (!property) return;
      property.markFinal(status);
      await this.programPropertyRepository.update(property);
    } catch (error: any) {
      this.logger.error(`Итог паевого взноса имуществом ${hash} не записан: ${error?.message}`, error?.stack);
    }
  }
}
