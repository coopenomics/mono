import { Inject, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';
import {
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  bucketProvidersFor,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { FILE_STORAGE_PORT, LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { SupportDatabaseModule } from './infrastructure/database/support-database.module';
import { SUPPORT_TICKET_REPOSITORY } from './domain/repositories/support-ticket.repository';
import { SUPPORT_TICKET_MESSAGE_REPOSITORY } from './domain/repositories/support-ticket-message.repository';
import { SUPPORT_TICKET_ATTACHMENT_REPOSITORY } from './domain/repositories/support-ticket-attachment.repository';
import { SUPPORT_TICKET_PARTICIPANT_REPOSITORY } from './domain/repositories/support-ticket-participant.repository';
import { SupportTicketTypeormRepository } from './infrastructure/repositories/support-ticket.typeorm-repository';
import { SupportTicketMessageTypeormRepository } from './infrastructure/repositories/support-ticket-message.typeorm-repository';
import { SupportTicketAttachmentTypeormRepository } from './infrastructure/repositories/support-ticket-attachment.typeorm-repository';
import { SupportTicketParticipantTypeormRepository } from './infrastructure/repositories/support-ticket-participant.typeorm-repository';
import { SupportAttachmentsService } from './application/services/support-attachments.service';
import { SupportCommandsService } from './application/services/support-commands.service';
import { SupportAutoCloseService } from './application/services/support-auto-close.service';
import { SupportTicketNotificationService } from './application/services/support-ticket-notification.service';
import { SupportQueriesService } from './application/services/support-queries.service';
import { SupportVisibilityService } from './application/services/support-visibility.service';
import { SupportQueriesResolver } from './application/resolvers/support-queries.resolver';
import { SupportMutationsResolver } from './application/resolvers/support-mutations.resolver';

/**
 * Обращение, лента переписки и вложения не заводят своих переключателей в
 * конфиге расширения — конфигурировать здесь пока нечего.
 */
export const Schema = z.object({});
export const defaultConfig = {};
export type IConfig = z.infer<typeof Schema>;

@Injectable()
export class SupportExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    super();
    this.logger.setContext(SupportExtension.name);
  }

  name = 'support';
  extension!: ExtensionDomainEntity<IConfig>;
  configSchemas = Schema;
  defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error('Конфиг стола поддержки не найден');

    this.extension = extensionData;
    this.logger.log('Стол поддержки инициализирован');
  }
}

@Module({
  imports: [SupportDatabaseModule],
  providers: [
    SupportExtension,
    // Хранилище вложений: объявление бакета висит на самом сервисе
    // (`@UseBucket`), здесь оно превращается в провайдер.
    ...bucketProvidersFor(FILE_STORAGE_PORT, [SupportAttachmentsService]),
    // Репозитории
    {
      provide: SUPPORT_TICKET_REPOSITORY,
      useClass: SupportTicketTypeormRepository,
    },
    {
      provide: SUPPORT_TICKET_MESSAGE_REPOSITORY,
      useClass: SupportTicketMessageTypeormRepository,
    },
    {
      provide: SUPPORT_TICKET_ATTACHMENT_REPOSITORY,
      useClass: SupportTicketAttachmentTypeormRepository,
    },
    {
      provide: SUPPORT_TICKET_PARTICIPANT_REPOSITORY,
      useClass: SupportTicketParticipantTypeormRepository,
    },
    // Прикладной слой: команды, вложения, автозакрытие.
    SupportAttachmentsService,
    SupportCommandsService,
    SupportAutoCloseService,
    // Слушатель событий стола. Экспортировать его незачем: наружу он не
    // вызывается, подписки поднимает сам при старте модуля.
    SupportTicketNotificationService,
    // Слой чтений. Обезличивание вынесено отдельным провайдером и наружу не
    // экспортируется: пользоваться им должен только слой чтений, иначе
    // «единственное место» перестанет быть единственным.
    SupportVisibilityService,
    SupportQueriesService,
    // Слой доступа.
    SupportQueriesResolver,
    SupportMutationsResolver,
  ],
  exports: [SupportExtension, SupportCommandsService, SupportQueriesService],
})
export class SupportExtensionModule {
  constructor(private readonly supportExtension: SupportExtension) {}

  async initialize() {
    await this.supportExtension.initialize();
  }
}
