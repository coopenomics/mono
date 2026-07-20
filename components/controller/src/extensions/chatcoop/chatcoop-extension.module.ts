import { Module, Injectable, Inject } from '@nestjs/common';
import { BaseExtModule } from '../base.extension.module';
import { ChatCoopDatabaseModule } from './infrastructure/database/chatcoop-database.module';
import { ChatCoopApplicationService } from './application/services/chatcoop-application.service';
import { MatrixApiService } from './application/services/matrix-api.service';
import { MatrixUserManagementService } from './domain/services/matrix-user-management.service';
import { UnionChatService } from './domain/services/union-chat.service';
import { UnionChatTypeormRepository } from './infrastructure/repositories/union-chat.typeorm-repository';
import { UNION_CHAT_REPOSITORY } from './domain/repositories/union-chat.repository';
import { ActiveUserStatusGuard } from '~/application/auth/guards/active-user-status.guard';
import { ChatCoopResolver } from './application/resolvers/chatcoop.resolver';
import { ChatCoopCalendarResolver } from './application/resolvers/chatcoop-calendar.resolver';
import { ChatCoopCalendarFeedController } from './application/controllers/chatcoop-calendar-feed.controller';
import { TranscriptionResolver } from './application/resolvers/transcription.resolver';
import { ProjectCommunicationResolver } from './application/resolvers/project-communication.resolver';
import { SecretaryRoomsResolver } from './application/resolvers/secretary-rooms.resolver';
import { SecretaryRoomManagementService } from './application/services/secretary-room-management.service';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { INTER_COOP_CALENDAR_EVENT_NOTIFICATION } from '@coopenomics/inter';
import { ChatcoopCalendarEventNotificationService } from './application/services/chatcoop-calendar-event-notification.service';
import { ExtensionDomainRepository } from '~/domain/extension/repositories/extension-domain.repository';
import { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { VarsRepository, VARS_REPOSITORY } from '~/domain/common/repositories/vars.repository';
import { VarsRepositoryImplementation } from '~/infrastructure/database/generator-repositories/repositories/vars-generator.repository';
import type { DeserializedDescriptionOfExtension } from '~/types/shared';
import { encrypt } from '~/utils/aes';
import * as crypto from 'crypto';
import config from '~/config/config';

// Новые сервисы и репозитории для секретаря и транскрипции
import { TranscriptionManagementService } from './domain/services/transcription-management.service';
import { CALL_TRANSCRIPTION_REPOSITORY } from './domain/repositories/call-transcription.repository';
import { TRANSCRIPTION_SEGMENT_REPOSITORY } from './domain/repositories/transcription-segment.repository';
import { CallTranscriptionTypeormRepository } from './infrastructure/repositories/call-transcription.typeorm-repository';
import { TranscriptionSegmentTypeormRepository } from './infrastructure/repositories/transcription-segment.typeorm-repository';
import { SecretaryAgentService } from './application/services/secretary-agent.service';
import { WhisperSttService } from './application/services/whisper-stt.service';
import { LiveKitWebhookController } from './application/controllers/livekit-webhook.controller';
import { COOPERATIVE_MEMBERS_ROOM_MATRIX } from './application/config/matrix-cooperative-members-room.config';
import { COUNCIL_ROOM_MATRIX } from './application/config/matrix-council-room.config';
import { CapitalProjectMatrixSyncService } from './application/services/capital-project-matrix-sync.service';
import { CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY } from './domain/repositories/managed-matrix-room.repository';
import type { ChatcoopManagedMatrixRoomRepository } from './domain/repositories/managed-matrix-room.repository';
import { ManagedMatrixRoomTypeormRepository } from './infrastructure/repositories/managed-matrix-room.typeorm-repository';
import { ROOM_MESSAGE_HISTORY_REPOSITORY } from './domain/repositories/room-message-history.repository';
import { RoomMessageHistoryTypeormRepository } from './infrastructure/repositories/room-message-history.typeorm-repository';
import { MatrixRoomMessageHistoryIngestService } from './application/services/matrix-room-message-history-ingest.service';
import { ChatCoopSecretaryMatrixTokenService } from './application/services/chatcoop-secretary-matrix-token.service';
import { MatrixRoomMessageHistoryCronService } from './application/services/matrix-room-message-history-cron.service';
import { ChatcoopInterProjectCommunicationArtifactsAdapter } from './infrastructure/inter/chatcoop-inter-project-communication-artifacts.adapter';
import { ChatcoopInterMatrixRoomMessagingAdapter } from './infrastructure/inter/chatcoop-inter-matrix-room-messaging.adapter';
import { ChatcoopInterChatCoopCalendarAdapter } from './infrastructure/inter/chatcoop-inter-chatcoop-calendar.adapter';
import { ChatCoopCalendarApplicationService } from './application/services/chatcoop-calendar-application.service';
import { CalendarEventTypeormRepository } from './infrastructure/repositories/calendar-event.typeorm-repository';
import { CalendarIcsSubscriptionTypeormRepository } from './infrastructure/repositories/calendar-ics-subscription.typeorm-repository';
import { CHATCOOP_CALENDAR_EVENT_REPOSITORY } from './domain/repositories/calendar-event.repository';
import { CHATCOOP_CALENDAR_ICS_SUBSCRIPTION_REPOSITORY } from './domain/repositories/calendar-ics-subscription.repository';
import { CHATCOOP_STATE_REPOSITORY } from './domain/repositories/chatcoop-state.repository';
import type { ChatcoopStateRepository } from './domain/repositories/chatcoop-state.repository';
import { ChatcoopStateTypeormRepository } from './infrastructure/repositories/chatcoop-state.typeorm-repository';

// Функция для проверки и сериализации FieldDescription
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

// Схема конфигурации для чаткооп (только то, что безопасно терять при переустановке расширения; space/секретарь — в PG `chatcoop_state`)
export const Schema = z.object({
  /** Интервал cron-синхронизации истории Matrix (текст/голос) по незашифрованным комнатам реестра */
  messageHistorySyncIntervalMinutes: z
    .number()
    .min(1)
    .max(60)
    .default(2)
    .describe(
      describeField({
        label: 'Интервал синхронизации истории чата (мин)',
        note: 'Как часто бот подтягивает сообщения в PG (независимо от звонков). 1 = каждую минуту.',
        visible: true,
      })
    ),
});

// Дефолтные параметры конфигурации
export const defaultConfig = {
  messageHistorySyncIntervalMinutes: 2,
};

// Автоматическое создание типа IConfig на основе Zod-схемы
export type IConfig = z.infer<typeof Schema>;

// Репозитории
import { MatrixUserTypeormRepository } from './infrastructure/repositories/matrix-user.typeorm-repository';
import { TypeOrmExtensionDomainRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-extension.repository';

// Символы для DI
import { MATRIX_USER_REPOSITORY } from './domain/repositories/matrix-user.repository';
import { EXTENSION_REPOSITORY } from '~/domain/extension/repositories/extension-domain.repository';

@Injectable()
export class ChatCoopPlugin extends BaseExtModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(VARS_REPOSITORY) private readonly varsRepository: VarsRepository,
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedMatrixRooms: ChatcoopManagedMatrixRoomRepository,
    @Inject(CHATCOOP_STATE_REPOSITORY) private readonly chatcoopState: ChatcoopStateRepository,
    private readonly logger: WinstonLoggerService,
    private readonly matrixApiService: MatrixApiService,
    private readonly chatCoopApplicationService: ChatCoopApplicationService
  ) {
    super();
    this.logger.setContext(ChatCoopPlugin.name);
  }

  name = 'chatcoop';
  plugin!: ExtensionDomainEntity<IConfig>;
  configSchemas = Schema;
  defaultConfig = defaultConfig;

  /** В JSON расширения храним только публичные настройки (интервал cron и т.д.). */
  private async persistExtensionPublicConfig(): Promise<void> {
    const interval =
      this.plugin?.config?.messageHistorySyncIntervalMinutes ?? defaultConfig.messageHistorySyncIntervalMinutes;
    await this.extensionRepository.update({
      name: this.name,
      config: { messageHistorySyncIntervalMinutes: interval },
    });
    const refreshed = await this.extensionRepository.findByName(this.name);
    if (refreshed) {
      this.plugin = refreshed;
    }
  }

  async initialize(): Promise<void> {
    try {
      this.logger.log('Инициализация модуля чаткооп...');

      // Получаем конфигурацию плагина
      const pluginData = await this.extensionRepository.findByName(this.name);
      if (!pluginData) throw new Error('Конфиг чаткооп не найден');

      this.plugin = pluginData;

      // Выполняем логин администратора при инициализации
      await this.matrixApiService.loginAdmin();

      // Отложенная инициализация (MongoDB/Generator могут быть ещё не готовы)
      setTimeout(async () => {
        try {
          const st = await this.chatcoopState.getSingleton();
          if (!st.isInitialized) {
            await this.initializeCooperativeSpace();
          } else {
            await this.ensureMembersRoomInRegistryIfMissing();
          }
          const st2 = await this.chatcoopState.getSingleton();
          const hasSecretaryCreds =
            typeof st2.secretaryMatrixUserId === 'string' &&
            st2.secretaryMatrixUserId.trim().length > 0 &&
            typeof st2.secretaryPasswordEncrypted === 'string' &&
            st2.secretaryPasswordEncrypted.length > 0;
          if (!hasSecretaryCreds && config.livekit?.url) {
            await this.initializeSecretary();
          }
          const refreshed = await this.extensionRepository.findByName(this.name);
          if (refreshed) {
            this.plugin = refreshed;
          }
          await this.ensureSecretaryInEligibleMatrixRoomsIfConfigured();
          this.logger.log('Модуль чаткооп успешно инициализирован');
        } catch (error) {
          this.logger.error('Не удалось инициализировать модуль чаткооп', JSON.stringify(error));
        }
      }, 10000);

      // Инициализация секретаря будет выполнена позже в onModuleInit
      // с задержкой, чтобы генератор успел инициализироваться

      this.logger.log('Модуль чаткооп успешно инициализирован');
    } catch (error) {
      console.error(error)
      this.logger.error('Не удалось инициализировать модуль чаткооп', JSON.stringify(error));
      throw error;
    }
  }

  /**
   * Отложенная инициализация секретаря после того, как генератор будет готов.
   * Выполняется только если расширение установлено (this.plugin задаётся в initialize()).
   */
  async onModuleInit(): Promise<void> {
    setTimeout(async () => {
      try {
        // Расширение не установлено — initialize() не вызывался, пропускаем
        if (!this.plugin?.config) {
          return;
        }
        const st = await this.chatcoopState.getSingleton();
        if (st.isInitialized) {
          await this.ensureMembersRoomInRegistryIfMissing();
        }
        const st2 = await this.chatcoopState.getSingleton();
        const hasSecretaryCreds =
          typeof st2.secretaryMatrixUserId === 'string' &&
          st2.secretaryMatrixUserId.trim().length > 0 &&
          typeof st2.secretaryPasswordEncrypted === 'string' &&
          st2.secretaryPasswordEncrypted.length > 0;
        if (!hasSecretaryCreds && config.livekit?.url) {
          await this.initializeSecretary();
        }
        const refreshed = await this.extensionRepository.findByName(this.name);
        if (refreshed) {
          this.plugin = refreshed;
        }
        await this.ensureSecretaryInEligibleMatrixRoomsIfConfigured();
      } catch (error) {
        this.logger.error('Не удалось инициализировать секретаря в onModuleInit', JSON.stringify(error));
      }
    }, 10000);
  }

  /**
   * При уже инициализированном пространстве: если в PG нет записи kind=members — создать комнату в Matrix, реестр, пригласить пайщиков.
   */
  private async ensureMembersRoomInRegistryIfMissing(): Promise<void> {
    try {
      const latest = await this.extensionRepository.findByName(this.name);
      if (!latest) {
        return;
      }
      this.plugin = latest;
      const st = await this.chatcoopState.getSingleton();
      if (!st.isInitialized) {
        return;
      }
      const spaceId = st.spaceId;
      if (typeof spaceId !== 'string' || spaceId.trim().length === 0) {
        this.logger.warn(
          'ChatCoop: isInitialized без spaceId в chatcoop_state — автоматически не создаём комнату пайщиков'
        );
        return;
      }

      const membersRows = await this.managedMatrixRooms.findByKind('members');
      if (membersRows.length > 0) {
        return;
      }

      this.logger.log('ChatCoop: в реестре нет комнаты пайщиков — создаём и синхронизируем пользователей');
      await this.matrixApiService.loginAdmin();

      const vars = await this.varsRepository.get();
      if (!vars) {
        throw new Error('Не удалось получить переменные кооператива для комнаты пайщиков');
      }

      const membersRoomName = `Комната пайщиков ${vars.short_abbr} ${vars.name}`;
      const membersMatrix = COOPERATIVE_MEMBERS_ROOM_MATRIX;
      const adminUserId = this.matrixApiService.getAdminUserId();
      const membersRoomPowerLevels = membersMatrix.buildPowerLevels(adminUserId);

      const membersRoomId = await this.matrixApiService.createRoom(
        membersRoomName,
        'Чат для всех пайщиков кооператива',
        membersMatrix.isPrivate,
        membersMatrix.roomType,
        membersMatrix.initialState.length > 0 ? membersMatrix.initialState : undefined,
        membersMatrix.encrypt,
        membersRoomPowerLevels
      );

      await this.matrixApiService.addRoomToSpace(spaceId.trim(), membersRoomId);

      await this.managedMatrixRooms.upsertRoom({
        matrixRoomId: membersRoomId,
        encrypted: membersMatrix.encrypt,
        kind: 'members',
        displayLabel: 'Комната пайщиков',
        projectHash: null,
      });

      await this.chatCoopApplicationService.syncExistingUsersToChatCoopRooms();
      this.logger.log(`ChatCoop: комната пайщиков создана и записана в реестр: ${membersRoomId}`);
    } catch (e) {
      this.logger.error('ChatCoop: ensureMembersRoomInRegistryIfMissing', JSON.stringify(e));
    }
  }

  /**
   * Инициализирует пространство и комнаты для кооператива
   */
  private async initializeCooperativeSpace(): Promise<void> {
    try {
      this.logger.log('Инициализация пространства и комнат кооператива...');

      // Получаем переменные кооператива
      const vars = await this.varsRepository.get();
      if (!vars) {
        throw new Error('Не удалось получить переменные кооператива');
      }

      const spaceName = `${vars.short_abbr} ${vars.name.toUpperCase()}`;
      const membersRoomName = `Комната пайщиков ${vars.short_abbr} ${vars.name}`;
      const councilRoomName = `Комната совета ${vars.short_abbr} ${vars.name}`;

      // Получаем user_id администратора Matrix
      const adminUserId = this.matrixApiService.getAdminUserId();

      const membersMatrix = COOPERATIVE_MEMBERS_ROOM_MATRIX;
      const membersRoomPowerLevels = membersMatrix.buildPowerLevels(adminUserId);

      const councilMatrix = COUNCIL_ROOM_MATRIX;
      const councilRoomPowerLevels = councilMatrix.buildPowerLevels(adminUserId);

      // Создаем пространство кооператива
      const spaceId = await this.matrixApiService.createSpace(spaceName, `Частное пространство кооператива ${vars.name}`);
      this.logger.log(`Создано пространство кооператива: ${spaceId}`);

      const membersRoomId = await this.matrixApiService.createRoom(
        membersRoomName,
        'Чат для всех пайщиков кооператива',
        membersMatrix.isPrivate,
        membersMatrix.roomType,
        membersMatrix.initialState.length > 0 ? membersMatrix.initialState : undefined,
        membersMatrix.encrypt,
        membersRoomPowerLevels
      );
      this.logger.log(`Создана комната пайщиков: ${membersRoomId}`);

      // Создаем комнату для совета
      const councilRoomId = await this.matrixApiService.createRoom(
        councilRoomName,
        'Чат для членов совета кооператива',
        councilMatrix.isPrivate,
        councilMatrix.roomType,
        councilMatrix.initialState.length > 0 ? councilMatrix.initialState : undefined,
        councilMatrix.encrypt,
        councilRoomPowerLevels
      );
      this.logger.log(`Создана комната совета: ${councilRoomId}`);
      this.logger.log(`Все комнаты созданы: space=${spaceId}, members=${membersRoomId}, council=${councilRoomId}`);

      // Добавляем комнаты в пространство
      await this.matrixApiService.addRoomToSpace(spaceId, membersRoomId);
      await this.matrixApiService.addRoomToSpace(spaceId, councilRoomId);

      await this.chatcoopState.merge({
        spaceId,
        isInitialized: true,
      });
      await this.persistExtensionPublicConfig();
      this.logger.log(`Состояние PG: spaceId=${spaceId}; комнаты — в реестре chatcoop_managed_matrix_rooms`);

      // Реестр: пайщики (plaintext), совет (E2EE)
      await this.managedMatrixRooms.upsertRoom({
        matrixRoomId: membersRoomId,
        encrypted: membersMatrix.encrypt,
        kind: 'members',
        displayLabel: 'Комната пайщиков',
        projectHash: null,
      });
      await this.managedMatrixRooms.upsertRoom({
        matrixRoomId: councilRoomId,
        encrypted: councilMatrix.encrypt,
        kind: 'council',
        displayLabel: 'Комната совета',
        projectHash: null,
      });

      // Синхронизируем существующих пользователей в комнаты чаткооп
      await this.chatCoopApplicationService.syncExistingUsersToChatCoopRooms();

      await this.initializeSecretary();

      this.logger.log('Пространство, комнаты кооператива и секретарь успешно инициализированы');
    } catch (error) {
      this.logger.error('Не удалось инициализировать пространство и комнаты кооператива', JSON.stringify(error));
      throw error;
    }
  }

  /**
   * Инициализирует сервисный аккаунт секретаря для транскрипции звонков
   * Создает Matrix-аккаунт, шифрует credentials и сохраняет в Vault
   */
  private async initializeSecretary(): Promise<void> {
    if (!this.plugin?.config) {
      return;
    }
    try {
      this.logger.log('Инициализация сервисного аккаунта секретаря...');

      // Получаем имя кооператива для формирования username
      const vars = await this.varsRepository.get();
      if (!vars) {
        throw new Error('Не удалось получить переменные кооператива');
      }

      const coopname = vars.coopname || config.coopname;

      const existingState = await this.chatcoopState.getSingleton();
      if (existingState.secretaryUsername && existingState.secretaryPasswordEncrypted) {
        this.logger.log(`Используем существующего Matrix секретаря: ${existingState.secretaryUsername}`);
        const existingId = existingState.secretaryMatrixUserId;
        if (typeof existingId === 'string' && existingId.trim().length > 0) {
          await this.ensureSecretaryInEligibleMatrixRooms(existingId.trim());
        }
        return;
      }

      // Создаем нового секретаря
      const randomSuffix = Math.random().toString(36).substring(2, 5);
      const secretaryUsername = `secretary-${coopname}-${randomSuffix}`;
      const secretaryPassword = crypto.randomBytes(32).toString('hex');
      const displayName = `Секретарь | ${vars.short_abbr} ${vars.name}`;

      this.logger.log(`Создание Matrix аккаунта секретаря: ${secretaryUsername}`);

      // Регистрируем Matrix-аккаунт секретаря
      const registerResponse = await this.matrixApiService.registerUser(
        secretaryUsername,
        secretaryPassword,
        `secretary-${coopname}-${randomSuffix}`,
        undefined,
        displayName,
        undefined,
        false // не администратор
      );

      this.logger.log(`Аккаунт секретаря создан: ${registerResponse.user_id}`);

      // В E2EE-комнату совета секретарь не приглашается (ensureSecretaryInEligibleMatrixRooms только encrypted === false).
      // Комната пайщиков — plaintext в реестре; секретарь вступит при ensureSecretaryInEligibleMatrixRooms.

      // Шифруем пароль для хранения в конфигурации
      const encryptedPassword = encrypt(secretaryPassword);

      await this.chatcoopState.merge({
        secretaryMatrixUserId: registerResponse.user_id,
        secretaryUsername,
        secretaryPasswordEncrypted: encryptedPassword,
        secretaryInitialized: true,
      });
      await this.persistExtensionPublicConfig();

      await this.ensureSecretaryInEligibleMatrixRooms(registerResponse.user_id);

      this.logger.log(`Секретарь успешно инициализирован: ${registerResponse.user_id}`);
      this.logger.log(`Зашифрованный пароль сохранен (длина: ${encryptedPassword.length})`);
    } catch (error) {
      console.error(error)
      this.logger.error('Не удалось инициализировать секретаря', JSON.stringify(error));
      // Не выбрасываем ошибку — расширение продолжит работу без секретаря
    }
  }

  /**
   * При старте: если в конфиге есть Matrix ID секретаря — проверить членство во всех незашифрованных комнатах реестра и при необходимости вступить.
   */
  private async ensureSecretaryInEligibleMatrixRoomsIfConfigured(): Promise<void> {
    const st = await this.chatcoopState.getSingleton();
    const sid = st.secretaryMatrixUserId;
    if (typeof sid !== 'string' || !sid.trim()) {
      return;
    }
    await this.ensureSecretaryInEligibleMatrixRooms(sid.trim());
  }

  /**
   * Синхронизация секретаря с реестром `chatcoop_managed_matrix_rooms`: только encrypted === false.
   * Проверяем Matrix (участники комнаты), при отсутствии — join от имени админа; обновляем secretary_in_room в БД.
   */
  private async ensureSecretaryInEligibleMatrixRooms(secretaryMatrixUserId: string): Promise<void> {
    try {
      const rooms = await this.managedMatrixRooms.findEligibleForSecretaryTranscription();
      this.logger.log(
        `Секретарь: проверка членства в ${rooms.length} незашифрованных комнатах реестра ChatCoop`
      );
      for (const r of rooms) {
        try {
          let inRoom: boolean;
          try {
            inRoom = await this.matrixApiService.isUserInRoom(secretaryMatrixUserId, r.matrixRoomId);
          } catch (memberErr) {
            this.logger.warn(
              `Секретарь: не удалось прочитать участников ${r.matrixRoomId}: ${String(memberErr)}`
            );
            continue;
          }
          if (inRoom) {
            if (!r.secretaryInRoom) {
              await this.managedMatrixRooms.setSecretaryInRoom(r.matrixRoomId, true);
            }
            continue;
          }
          await this.matrixApiService.joinRoom(secretaryMatrixUserId, r.matrixRoomId);
          await this.managedMatrixRooms.setSecretaryInRoom(r.matrixRoomId, true);
          this.logger.log(`Секретарь вступил в комнату ${r.matrixRoomId} (${r.kind})`);
        } catch (e) {
          this.logger.warn(`Секретарь: не вступил в ${r.matrixRoomId}: ${String(e)}`);
        }
      }
    } catch (e) {
      this.logger.warn(`ensureSecretaryInEligibleMatrixRooms: ${String(e)}`);
    }
  }
}

@Module({
  imports: [
    ChatCoopDatabaseModule,
    ConfigModule,
    AccountInfrastructureModule,
  ],
  controllers: [
    LiveKitWebhookController,
    ChatCoopCalendarFeedController,
  ],
  providers: [
    // Plugin
    ChatCoopPlugin,

    // Application Services
    ChatCoopApplicationService,
    CapitalProjectMatrixSyncService,
    SecretaryRoomManagementService,
    MatrixApiService,
    ChatCoopSecretaryMatrixTokenService,
    SecretaryAgentService,
    WhisperSttService,
    MatrixRoomMessageHistoryIngestService,
    MatrixRoomMessageHistoryCronService,
    ChatcoopInterProjectCommunicationArtifactsAdapter,
    ChatcoopInterMatrixRoomMessagingAdapter,
    ChatcoopInterChatCoopCalendarAdapter,
    ChatCoopCalendarApplicationService,
    ChatcoopCalendarEventNotificationService,
    {
      provide: INTER_COOP_CALENDAR_EVENT_NOTIFICATION,
      useExisting: ChatcoopCalendarEventNotificationService,
    },

    // Repositories
    {
      provide: EXTENSION_REPOSITORY,
      useClass: TypeOrmExtensionDomainRepository,
    },
    {
      provide: VARS_REPOSITORY,
      useClass: VarsRepositoryImplementation,
    },

    // Domain Services
    MatrixUserManagementService,
    UnionChatService,
    TranscriptionManagementService,

    // Repositories — Matrix
    {
      provide: MATRIX_USER_REPOSITORY,
      useClass: MatrixUserTypeormRepository,
    },
    {
      provide: UNION_CHAT_REPOSITORY,
      useClass: UnionChatTypeormRepository,
    },

    // Repositories — Transcriptions
    {
      provide: CALL_TRANSCRIPTION_REPOSITORY,
      useClass: CallTranscriptionTypeormRepository,
    },
    {
      provide: TRANSCRIPTION_SEGMENT_REPOSITORY,
      useClass: TranscriptionSegmentTypeormRepository,
    },
    {
      provide: CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY,
      useClass: ManagedMatrixRoomTypeormRepository,
    },
    {
      provide: CHATCOOP_STATE_REPOSITORY,
      useClass: ChatcoopStateTypeormRepository,
    },
    {
      provide: ROOM_MESSAGE_HISTORY_REPOSITORY,
      useClass: RoomMessageHistoryTypeormRepository,
    },
    {
      provide: CHATCOOP_CALENDAR_EVENT_REPOSITORY,
      useClass: CalendarEventTypeormRepository,
    },
    {
      provide: CHATCOOP_CALENDAR_ICS_SUBSCRIPTION_REPOSITORY,
      useClass: CalendarIcsSubscriptionTypeormRepository,
    },

    // GraphQL Resolvers
    ChatCoopResolver,
    ChatCoopCalendarResolver,
    TranscriptionResolver,
    ActiveUserStatusGuard,
    ProjectCommunicationResolver,
    SecretaryRoomsResolver,
  ],
  exports: [
    ChatCoopPlugin,
    ChatCoopApplicationService,
    ChatcoopInterProjectCommunicationArtifactsAdapter,
    ChatcoopInterMatrixRoomMessagingAdapter,
    ChatcoopInterChatCoopCalendarAdapter,
    ChatcoopCalendarEventNotificationService,
    INTER_COOP_CALENDAR_EVENT_NOTIFICATION,
  ],
})
export class ChatCoopPluginModule {
  constructor(private readonly chatcoopPlugin: ChatCoopPlugin) {}

  async initialize() {
    await this.chatcoopPlugin.initialize();
  }
}
