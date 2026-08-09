import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MatrixUserManagementService } from '../../domain/services/matrix-user-management.service';
import { UnionChatService } from '../../domain/services/union-chat.service';
import { MatrixApiService } from './matrix-api.service';
import { MatrixAccountStatusResponseDTO } from '../dto/matrix-account-status.dto';
import { AccountDataPort, ACCOUNT_DATA_PORT } from '~/domain/account/ports/account-data.port';
import { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import {
  ExtensionDomainRepository,
  EXTENSION_REPOSITORY,
} from '@coopenomics/extension-kit';
import { IConfig } from '../../chatcoop-extension.module';
import {
  CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY,
  type ChatcoopManagedMatrixRoomRepository,
} from '../../domain/repositories/managed-matrix-room.repository';
import {
  CHATCOOP_STATE_REPOSITORY,
  type ChatcoopStateRepository,
} from '../../domain/repositories/chatcoop-state.repository';
import type { ChatcoopManagedMatrixRoomKind } from '../../domain/entities/managed-matrix-room.entity';
import {
  CHATCOOP_MATRIX_USER_LINKED_FOR_CAPITAL_PROJECT_ROOMS_EVENT,
  type IChatCoopMatrixUserLinkedForCapitalProjectRoomsPayload,
} from '~/shared/constants/capital-project-matrix.events';
import config from '~/config/config';
import { COOPERATIVE_VARS_PORT, type ICooperativeVarsPort } from '@coopenomics/innercoop';

// Расширяем тип config для доступа к matrix.client_url
const extendedConfig = config as typeof config & {
  matrix: typeof config.matrix & { client_url: string };
};

/**
 * Извлекает display name из данных аккаунта и информации о кооперативе
 */
function extractDisplayName(account: AccountDomainEntity, cooperativeName: string, logger: Logger): string {
  try {
    let userName = '';

    // Получаем данные из private_account
    if (account.private_account) {
      const privateData = account.private_account;

      if (privateData.type === 'individual' && privateData.individual_data) {
        // Для физического лица
        const { first_name, last_name } = privateData.individual_data;
        userName = `${first_name} ${last_name}`;
      } else if (privateData.type === 'organization' && privateData.organization_data) {
        // Для организации - используем represented_by
        const { represented_by } = privateData.organization_data;
        if (represented_by) {
          userName = `${represented_by.first_name} ${represented_by.last_name}`;
        }
      } else if (privateData.type === 'entrepreneur' && privateData.entrepreneur_data) {
        // Для ИП
        const { first_name, last_name } = privateData.entrepreneur_data;
        userName = `${first_name} ${last_name}`;
      }
    }

    if (userName && cooperativeName) {
      return `${userName} | ${cooperativeName}`;
    }

    throw new Error('Unable to extract display name: missing user data or cooperative info');
  } catch (error) {
    logger.warn(`Не удалось извлечь отображаемое имя из данных аккаунта: ${error}`);
    return account.username;
  }
}

/**
 * Извлекает контактные данные (телефон, email) из аккаунта
 */
function extractContactInfo(account: AccountDomainEntity, logger: Logger): { phone?: string; email?: string } {
  try {
    const result: { phone?: string; email?: string } = {};

    // Email из provider_account
    if (account.provider_account?.email) {
      result.email = account.provider_account.email;
    }

    // Телефон из private_account
    if (account.private_account) {
      const privateData = account.private_account;

      if (privateData.type === 'individual' && privateData.individual_data?.phone) {
        result.phone = privateData.individual_data.phone;
      } else if (privateData.type === 'organization' && privateData.organization_data?.phone) {
        result.phone = privateData.organization_data.phone;
      } else if (privateData.type === 'entrepreneur' && privateData.entrepreneur_data?.phone) {
        result.phone = privateData.entrepreneur_data.phone;
      }
    }

    return result;
  } catch (error) {
    logger.warn(`Не удалось извлечь контактную информацию из данных аккаунта: ${error}`);
    return {};
  }
}

/**
 * Подключение пайщика к мессенджеру кооператива: учётная запись Matrix, общие комнаты, союзные чаты.
 * Участие в чатах проектов Благороста настраивается отдельно через общие события (без прямой связи с модулем Capital).
 */
@Injectable()
export class ChatCoopApplicationService {
  private readonly logger = new Logger(ChatCoopApplicationService.name);

  constructor(
    private readonly matrixUserManagementService: MatrixUserManagementService,
    private readonly matrixApiService: MatrixApiService,
    private readonly unionChatService: UnionChatService,
    private readonly configService: ConfigService,
    @Inject(ACCOUNT_DATA_PORT) private readonly accountDataPort: AccountDataPort,
    @Inject(COOPERATIVE_VARS_PORT) private readonly cooperativeVars: ICooperativeVarsPort,
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedMatrixRooms: ChatcoopManagedMatrixRoomRepository,
    @Inject(CHATCOOP_STATE_REPOSITORY) private readonly chatcoopState: ChatcoopStateRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /** Актуальный Matrix room id из реестра PG (после миграции v3 комнаты не хранятся в конфиге расширения). */
  private async getPrimaryManagedRoomId(kind: ChatcoopManagedMatrixRoomKind): Promise<string | undefined> {
    const rows = await this.managedMatrixRooms.findByKind(kind);
    if (rows.length === 0) {
      return undefined;
    }
    if (rows.length > 1) {
      this.logger.warn(
        `ChatCoop: в реестре ${rows.length} записей kind=${kind}, используется ${rows[0].matrixRoomId}`
      );
    }
    return rows[0].matrixRoomId;
  }

  /**
   * Сообщаем остальной системе: у этого пайщика теперь есть рабочий доступ к Matrix в коопе.
   * Тогда можно добросить его во все комнаты проектов, где совет уже одобрил заявку, но раньше не могли внести из‑за отсутствия Matrix.
   */
  private emitMatrixUserLinkedForCapitalProjectRooms(coopUsername: string): void {
    const payload: IChatCoopMatrixUserLinkedForCapitalProjectRoomsPayload = {
      username: coopUsername.toLowerCase(),
    };
    this.eventEmitter.emit(CHATCOOP_MATRIX_USER_LINKED_FOR_CAPITAL_PROJECT_ROOMS_EVENT, payload);
  }

  async getMatrixAccountStatus(coopUsername: string): Promise<MatrixAccountStatusResponseDTO> {
    // Сначала проверяем локальную базу
    const matrixUser = await this.matrixUserManagementService.getMatrixUserByCoopUsername(coopUsername);

    if (matrixUser) {
      // Получаем URL Matrix клиента из конфигурации
      const matrixClientUrl = extendedConfig.matrix.client_url;

      try {
        const account = await this.accountDataPort.getAccount(coopUsername);
        await this.unionChatService.ensureUnionChat(account, matrixUser.matrixUserId);

        // Добавляем пользователя в комнаты чаткооп, если он еще не добавлен
        await this.addUserToChatCoopRooms(matrixUser.matrixUserId, account);
        // Допуск к проекту могли подтвердить раньше, чем человек снова открыл чат — повторно синхронизируем комнаты проектов
        this.emitMatrixUserLinkedForCapitalProjectRooms(coopUsername);
      } catch (error) {
        this.logger.warn(`Не удалось проверить/создать union-комнату или добавить пользователя в комнаты чаткооп: ${error}`);
      }

      return {
        hasAccount: true,
        matrixUsername: matrixUser.matrixUsername,
        iframeUrl: matrixClientUrl,
      };
    }

    // Если в локальной базе нет, проверяем email в Synapse
    try {
      const account = await this.accountDataPort.getAccount(coopUsername);
      const email = account.provider_account?.email;

      if (email) {
        const synapseUser = await this.matrixApiService.findUserByEmail(email);
        if (synapseUser) {
          // Добавляем найденного пользователя в локальную базу
          await this.matrixUserManagementService.createMatrixUser({
            coopUsername,
            matrixUserId: synapseUser.user_id,
            matrixUsername: synapseUser.name,
          });

          // Добавляем пользователя в комнаты чаткооп
          await this.addUserToChatCoopRooms(synapseUser.user_id, account);
          // В чат-сервере уже был пользователь с этим email — привязали к пайщику; теперь можно добавить во все подходящие комнаты проектов
          this.emitMatrixUserLinkedForCapitalProjectRooms(coopUsername);

          await this.unionChatService.ensureUnionChat(account, synapseUser.user_id);

          const matrixClientUrl = extendedConfig.matrix.client_url;
          return {
            hasAccount: true,
            matrixUsername: synapseUser.name,
            iframeUrl: matrixClientUrl,
          };
        }
      }
    } catch (error) {
      // Игнорируем ошибки проверки в Synapse, продолжаем как обычно
      this.logger.warn(`Не удалось проверить существующего пользователя в Synapse: ${error}`);
    }

    return {
      hasAccount: false,
    };
  }

  async createMatrixAccount(coopUsername: string, matrixUsername: string, password: string): Promise<boolean> {
    // Проверяем, не существует ли уже аккаунт
    const existingUser = await this.matrixUserManagementService.getMatrixUserByCoopUsername(coopUsername);
    if (existingUser) {
      throw new Error('Matrix аккаунт уже существует для данного пользователя');
    }

    // Получаем данные аккаунта и кооператива
    const [account, vars] = await Promise.all([this.accountDataPort.getAccount(coopUsername), this.cooperativeVars.get()]);

    // Извлекаем контактные данные
    const contactInfo = extractContactInfo(account, this.logger);
    const { email, phone } = contactInfo;

    // Формируем display name с названием кооператива
    if (!vars) {
      throw new Error('Unable to get cooperative information');
    }
    const cooperativeName = `${vars.shortAbbr} ${vars.name}`;
    const displayName = extractDisplayName(account, cooperativeName, this.logger);

    // Используем переданное имя пользователя без суффикса кооператива
    const fullMatrixUsername = matrixUsername.toLowerCase();

    this.logger.log(`Создание Matrix аккаунта для пользователя: ${fullMatrixUsername}`);
    this.logger.log(`Отображаемое имя: ${displayName}, Email: ${email}, Телефон: ${phone}`);

    try {
      // Регистрируем пользователя в Matrix через API с email, телефоном и display name
      const registerResponse = await this.matrixApiService.registerUser(
        fullMatrixUsername,
        password,
        coopUsername,
        email,
        displayName,
        phone
      );
      this.logger.log('Пользователь Matrix успешно зарегистрирован');

      // Сохраняем информацию о пользователе
      await this.matrixUserManagementService.createMatrixUser({
        coopUsername,
        matrixUserId: registerResponse.user_id,
        matrixUsername,
      });

      // Добавляем пользователя в комнаты чаткооп
      await this.addUserToChatCoopRooms(registerResponse.user_id, account);
      // Регистрация с нуля: общие комнаты готовы — проверяем проекты с уже одобренным участием этого пайщика
      this.emitMatrixUserLinkedForCapitalProjectRooms(coopUsername);

      await this.unionChatService.ensureUnionChat(account, registerResponse.user_id);

      return true;
    } catch (error) {
      console.error('Failed to create Matrix account:', error);
      throw new Error('Не удалось создать Matrix аккаунт');
    }
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    return this.matrixApiService.checkUsernameAvailability(username);
  }

  /**
   * Права как в комнате пайщиков (модерация звонков для chairman/member).
   * Используется для комнат проектов Capital.
   */
  async applyMembersRoomStylePowerForUser(matrixUserId: string, roomId: string, userRole: string): Promise<void> {
    await this.updateUserPowerLevel(matrixUserId, roomId, userRole, 'members');
  }

  /**
   * Обновляет права пользователя в комнате на основе его роли
   *
   * Уровни прав (power levels):
   * - 100: Администратор (полный контроль над комнатой)
   * - 50: Модератор (может создавать звонки, приглашать пользователей)
   * - 0: Обычный пользователь (может писать сообщения, участвовать в звонках)
   *
   * Комната пайщиков:
   * - chairman (председатель): 50 — может создавать звонки
   * - member (член совета): 50 — может создавать звонки
   * - user (обычный пайщик): 0 — может участвовать в звонках
   *
   * Комната совета:
   * - chairman (председатель): 50 — модератор комнаты
   * - member (член совета): 0 — обычные права (но может создавать звонки, т.к. m.call.invite = 0)
   */
  private async updateUserPowerLevel(
    matrixUserId: string,
    roomId: string,
    userRole: string,
    roomType: 'members' | 'council'
  ): Promise<void> {
    try {
      // Получаем текущие права комнаты
      const currentPowerLevels = await this.matrixApiService.getRoomPowerLevels(roomId);
      if (!currentPowerLevels) {
        this.logger.warn(`Не удалось получить права комнаты ${roomId}, пропускаем обновление прав пользователя`);
        return;
      }

      // Определяем требуемый уровень прав для пользователя
      let requiredPowerLevel = 0;

      if (roomType === 'members') {
        // В комнате пайщиков:
        // - chairman и member (члены совета) получают уровень 50 — могут создавать звонки (m.call.invite = 50)
        // - остальные пайщики остаются на уровне 0 — могут участвовать в звонках (m.call.answer = 0)
        if (userRole === 'chairman' || userRole === 'member') {
          requiredPowerLevel = 50;
        }
      } else if (roomType === 'council') {
        // В комнате совета:
        // - chairman получает уровень 50 — модератор
        // - member остается на уровне 0 — обычные права, но может создавать звонки (m.call.invite = 0)
        if (userRole === 'chairman') {
          requiredPowerLevel = 50;
        }
      }

      // Проверяем текущие права пользователя
      const currentUserPowerLevel = currentPowerLevels.users?.[matrixUserId] ?? 0;

      // Если права уже установлены правильно, пропускаем обновление
      if (currentUserPowerLevel === requiredPowerLevel) {
        this.logger.debug(`Права пользователя ${matrixUserId} в комнате ${roomType} уже установлены корректно (уровень ${requiredPowerLevel})`);
        return;
      }

      // Проверяем, можем ли мы изменить права пользователя
      // Если пользователь имеет уровень прав >= 100 (админ), мы не можем их изменить
      if (currentUserPowerLevel >= 100) {
        this.logger.warn(`Пользователь ${matrixUserId} имеет уровень прав ${currentUserPowerLevel}, который нельзя изменить. Пропускаем обновление.`);
        return;
      }

      // Обновляем права пользователя
      const updatedPowerLevels = { ...currentPowerLevels };
      if (!updatedPowerLevels.users) {
        updatedPowerLevels.users = {};
      }
      updatedPowerLevels.users[matrixUserId] = requiredPowerLevel;

      // Если есть пользователь с правами 50+, понижаем invite до 50 (чтобы могли приглашать только модераторы)
      const hasHighPrivilegedUser = Object.values(updatedPowerLevels.users).some((level: any) => level >= 50);
      if (hasHighPrivilegedUser) {
        updatedPowerLevels.invite = 50;
      }

      await this.matrixApiService.updateRoomPowerLevels(roomId, updatedPowerLevels);
      this.logger.log(`Права пользователя ${matrixUserId} в комнате ${roomType} обновлены с ${currentUserPowerLevel} до ${requiredPowerLevel}`);
    } catch (error) {
      this.logger.error(`Не удалось обновить права пользователя ${matrixUserId} в комнате ${roomId}: ${error}`);
    }
  }

  /**
   * Синхронизирует всех существующих пользователей в комнаты чаткооп
   * Вызывается после инициализации пространства кооператива
   */
  async syncExistingUsersToChatCoopRooms(): Promise<void> {
    try {
      this.logger.debug('Начинаем синхронизацию существующих пользователей в комнаты чаткооп...');

      // Небольшая задержка, чтобы конфигурация успела сохраниться
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Получаем всех существующих Matrix пользователей
      const existingUsers = await this.matrixUserManagementService.getAllMatrixUsers();

      if (!existingUsers || existingUsers.length === 0) {
        this.logger.log('Нет существующих Matrix пользователей для синхронизации');
        return;
      }

      this.logger.debug(`Найдено ${existingUsers.length} существующих пользователей для синхронизации`);

      // Обрабатываем каждого пользователя
      for (const matrixUser of existingUsers) {
        try {
          // Получаем данные аккаунта
          const account = await this.accountDataPort.getAccount(matrixUser.coopUsername);

          // Добавляем пользователя в комнаты чаткооп
          await this.addUserToChatCoopRooms(matrixUser.matrixUserId, account);

          this.logger.log(
            `Пользователь ${matrixUser.coopUsername} (${matrixUser.matrixUserId}) синхронизирован в комнаты чаткооп`
          );
        } catch (error) {
          this.logger.error(`Не удалось синхронизировать пользователя ${matrixUser.coopUsername}: ${error}`);
          // Продолжаем обработку других пользователей
        }
      }

      this.logger.log('Синхронизация существующих пользователей завершена');
    } catch (error) {
      this.logger.error(`Ошибка при синхронизации существующих пользователей: ${error}`);
      throw error;
    }
  }

  /**
   * Добавляет пользователя в комнаты чаткооп на основе его роли
   */
  private async addUserToChatCoopRooms(matrixUserId: string, account: AccountDomainEntity): Promise<void> {
    try {
      // Получаем конфигурацию чаткооп
      const chatcoopConfig = await this.extensionRepository.findByName('chatcoop');
      this.logger.debug(`Прочитана конфигурация чаткооп: ${JSON.stringify(chatcoopConfig?.config)}`);
      if (!chatcoopConfig) {
        this.logger.warn('ChatCoop extension not installed, skipping room assignment');
        return;
      }
      const st = await this.chatcoopState.getSingleton();
      if (!st.isInitialized) {
        this.logger.warn('ChatCoop Matrix space not initialized (chatcoop_state), skipping room assignment');
        return;
      }

      const spaceId = st.spaceId ?? undefined;
      const membersRoomId = await this.getPrimaryManagedRoomId('members');
      const councilRoomId = await this.getPrimaryManagedRoomId('council');
      this.logger.log(
        `Чаткооп: spaceId=${spaceId ?? '—'}, membersRoomId=${membersRoomId ?? '—'} (реестр), councilRoomId=${councilRoomId ?? '—'} (реестр)`
      );
      if (!membersRoomId) {
        this.logger.warn('ChatCoop: в реестре нет комнаты пайщиков (kind=members) — проверьте миграцию и initializeCooperativeSpace');
      }

      // Определяем роль пользователя
      const userRole = account.provider_account?.role || 'user';
      const isCouncilMember = userRole === 'member' || userRole === 'chairman';

      this.logger.log(
        `Пользователь ${matrixUserId}: роль=${userRole}, isCouncilMember=${isCouncilMember}, councilRoomId=${councilRoomId}`
      );

      // Все пользователи присоединяются к пространству
      if (spaceId) {
        try {
          // Проверяем, является ли пользователь уже членом пространства
          const isMember = await this.matrixApiService.isUserInRoom(matrixUserId, spaceId);
          if (!isMember) {
            await this.matrixApiService.joinRoom(matrixUserId, spaceId);
            this.logger.log(`Пользователь ${matrixUserId} присоединился к пространству ${spaceId}`);
          } else {
            this.logger.debug(`Пользователь ${matrixUserId} уже является членом пространства ${spaceId}`);
          }
        } catch (error) {
          this.logger.warn(`Не удалось проверить/добавить пользователя ${matrixUserId} в пространство ${spaceId}: ${error}`);
        }
      }

      // Все пайщики присоединяются к комнате пайщиков
      if (membersRoomId) {
        try {
          // Проверяем, является ли пользователь уже членом комнаты пайщиков
          const isMember = await this.matrixApiService.isUserInRoom(matrixUserId, membersRoomId);
          if (!isMember) {
            await this.matrixApiService.joinRoom(matrixUserId, membersRoomId);
            this.logger.log(`Пользователь ${matrixUserId} присоединился к комнате пайщиков ${membersRoomId}`);
          } else {
            this.logger.debug(`Пользователь ${matrixUserId} уже является членом комнаты пайщиков ${membersRoomId}`);
          }

          // Обновляем права пользователя в комнате пайщиков
          await this.updateUserPowerLevel(matrixUserId, membersRoomId, userRole, 'members');
        } catch (error) {
          this.logger.warn(`Не удалось добавить пользователя ${matrixUserId} в комнату пайщиков ${membersRoomId}: ${error}`);
        }
      }

      // Все пайщики присоединяются к общей комнате (если указана)
      if (extendedConfig.matrix.common_room_id) {
        try {
          // Проверяем, является ли пользователь уже членом общей комнаты
          const isMember = await this.matrixApiService.isUserInRoom(matrixUserId, extendedConfig.matrix.common_room_id);
          if (!isMember) {
            await this.matrixApiService.joinRoom(matrixUserId, extendedConfig.matrix.common_room_id);
            this.logger.log(
              `Пользователь ${matrixUserId} присоединился к общей комнате ${extendedConfig.matrix.common_room_id}`
            );
          } else {
            this.logger.debug(`Пользователь ${matrixUserId} уже является членом общей комнаты ${extendedConfig.matrix.common_room_id}`);
          }
        } catch (error) {
          this.logger.warn(
            `Не удалось проверить/добавить пользователя ${matrixUserId} в общую комнату ${extendedConfig.matrix.common_room_id}: ${error}`
          );
          // Не прерываем выполнение, продолжаем с другими комнатами
        }
      }

      // Члены совета также присоединяются к комнате совета
      this.logger.debug(
        `Проверка добавления в комнату совета: isCouncilMember=${isCouncilMember}, councilRoomId=${councilRoomId}`
      );
      if (isCouncilMember && councilRoomId) {
        try {
          // Проверяем, является ли пользователь уже членом комнаты совета
          const isMember = await this.matrixApiService.isUserInRoom(matrixUserId, councilRoomId);
          if (!isMember) {
            this.logger.log(`Добавляем члена совета ${matrixUserId} в комнату совета ${councilRoomId}`);
            await this.matrixApiService.joinRoom(matrixUserId, councilRoomId);
            this.logger.log(`Член совета ${matrixUserId} присоединился к комнате совета ${councilRoomId}`);
          } else {
            this.logger.debug(`Член совета ${matrixUserId} уже является членом комнаты совета ${councilRoomId}`);
          }

          // Обновляем права пользователя в комнате совета
          await this.updateUserPowerLevel(matrixUserId, councilRoomId, userRole, 'council');
        } catch (error) {
          this.logger.warn(`Не удалось добавить пользователя ${matrixUserId} в комнату совета ${councilRoomId}: ${error}`);
        }
      } else {
        this.logger.log(`Пользователь ${matrixUserId} НЕ добавлен в комнату совета`);
      }
    } catch (error) {
      this.logger.error(`Не удалось добавить пользователя в комнаты чаткооп: ${error}`);
      // Не выбрасываем ошибку, чтобы не блокировать создание аккаунта
    }
  }
}
