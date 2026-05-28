import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import config from '~/config/config';

interface MatrixLoginResponse {
  user_id: string;
  access_token: string;
  device_id: string;
  home_server: string;
}

interface MatrixRegisterResponse {
  user_id: string;
  access_token: string;
  device_id: string;
  home_server: string;
  matrix_username?: string; // Добавляем поле для сгенерированного username
}

interface CreateRoomResponse {
  room_id: string;
}

interface RoomInfo {
  room_id: string;
  name: string;
  canonical_alias?: string;
  joined_members: number;
  room_type?: string;
}

interface RoomsSearchResponse {
  rooms: RoomInfo[];
  offset: number;
  total_rooms: number;
}

interface RoomMembersResponse {
  members: string[];
  total: number;
}

interface MatrixSendEventResponse {
  event_id: string;
}

interface MatrixPinnedEventsState {
  pinned?: string[];
}

/** Событие из GET /rooms/.../messages (Client-Server API). */
export interface MatrixRoomTimelineEvent {
  event_id?: string;
  type?: string;
  sender?: string;
  origin_server_ts?: number;
  content?: Record<string, unknown>;
  unsigned?: Record<string, unknown>;
}

export interface MatrixRoomMessagesPage {
  chunk: MatrixRoomTimelineEvent[];
  start?: string;
  end?: string;
}

@Injectable()
export class MatrixApiService {
  private readonly logger = new Logger(MatrixApiService.name);
  /** Пауза после M_LIMIT_EXCEEDED / 429 для повторной попытки (мс). */
  private static extractMatrixRateLimitWaitMs(error: unknown): number | null {
    const err = error as { response?: { status?: number; data?: { errcode?: string; retry_after_ms?: number } } };
    const data = err.response?.data;
    const errcode = data?.errcode;
    if (errcode === 'M_LIMIT_EXCEEDED' || err.response?.status === 429 || err.response?.status === 503) {
      const rawMs = typeof data?.retry_after_ms === 'number' ? data.retry_after_ms : 3200;
      return Math.min(Math.max(rawMs, 500) + 200, 20_000);
    }
    return null;
  }

  private readonly homeserverUrl: string;
  private readonly adminUsername: string;
  private readonly adminPassword: string;
  private adminAccessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.homeserverUrl = config.matrix.homeserver_url;
    this.adminUsername = config.matrix.admin_username;
    this.adminPassword = config.matrix.admin_password;
    this.httpClient = axios.create({
      baseURL: this.homeserverUrl,
      timeout: 10000,
    });
  }

  async loginAdmin(): Promise<string> {
    try {
      // Проверяем, действителен ли текущий токен
      if (this.adminAccessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
        if (!this.adminAccessToken) {
          throw new Error('Admin access token is null');
        }
        return this.adminAccessToken;
      }

      const response = await this.httpClient.post<MatrixLoginResponse>('/_matrix/client/r0/login', {
        type: 'm.login.password',
        user: this.adminUsername,
        password: this.adminPassword,
      });

      this.adminAccessToken = response.data.access_token;
      // Токен Matrix обычно действителен долго, но будем обновлять каждые 24 часа для безопасности
      this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      this.logger.log('Администратор успешно вошел в Matrix');
      return this.adminAccessToken;
    } catch (error: any) {
      this.logger.error('Не удалось войти администратору в Matrix', error);
      throw new Error('Не удалось войти в Matrix как администратор');
    }
  }

  async registerUser(
    username: string,
    password: string,
    coopUsername: string,
    email?: string,
    displayName?: string,
    phone?: string,
    admin = false
  ): Promise<MatrixRegisterResponse> {
    try {
      this.logger.debug(`Регистрация пользователя Matrix: ${username}, email: ${email}, отображаемое имя: ${displayName}`);

      // Получаем admin токен
      const adminToken = await this.loginAdmin();

      // Проверяем существование пользователя по email, если email указан
      if (email) {
        const emailExists = await this.checkEmailExists(email);
        if (emailExists) {
          throw new Error('MATRIX_EMAIL_EXISTS');
        }
      }

      // Проверяем существование пользователя по username
      const checkUserId = `@${username}:${this.homeserverUrl.replace('https://', '').replace('http://', '')}`;

      // Пытаемся получить информацию о пользователе
      try {
        await this.httpClient.get(`/_synapse/admin/v2/users/${encodeURIComponent(checkUserId)}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
        // Если дошли сюда - пользователь уже существует
        throw new Error('MATRIX_USERNAME_EXISTS');
      } catch (error: any) {
        if (error.response?.status !== 404) {
          // Если ошибка не "не найден" - пробрасываем дальше
          throw error;
        }
        // 404 - пользователь не существует, можно создавать
      }

      // Формируем user_id в формате @username:server
      const userId = `@${username}:${this.homeserverUrl.replace('https://', '').replace('http://', '')}`;

      // Подготавливаем данные для создания пользователя
      const userData: any = {
        password,
        admin,
        deactivated: false,
        locked: false,
        external_ids: [
          {
            auth_provider: 'coopenomics',
            external_id: `${config.coopname}:${coopUsername}:${username}`,
          },
        ],
      };

      // Добавляем display name если указан
      if (displayName) {
        userData.displayname = displayName;
      }

      // Добавляем email и телефон если они предоставлены
      const threepids: Array<{ medium: 'email' | 'msisdn'; address: string }> = [];

      if (email) {
        threepids.push({
          medium: 'email',
          address: email,
        });
      }

      if (phone) {
        // Для телефона используем формат msisdn (MSISDN - Mobile Station International Subscriber Directory Number)
        threepids.push({
          medium: 'msisdn',
          address: phone.replace(/\D/g, ''), // Убираем все нецифровые символы
        });
      }

      if (threepids.length > 0) {
        userData.threepids = threepids;
      }

      // Создаем пользователя через Admin API v2
      const response = await this.httpClient.put<MatrixRegisterResponse>(
        `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`,
        userData,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      this.logger.debug(`Ответ регистрации пользователя: ${JSON.stringify(response.data)}`);

      // Добавляем username в ответ для обратной совместимости
      const result = {
        ...response.data,
        matrix_username: username,
        user_id: userId,
      };

      this.logger.log(`Пользователь ${username} успешно зарегистрирован в Matrix`);
      return result;
    } catch (error: any) {
      this.logger.error(`Не удалось зарегистрировать пользователя ${username} в Matrix`, error);
      throw new Error('Не удалось зарегистрировать пользователя в Matrix');
    }
  }

  async loginUser(username: string, password: string): Promise<MatrixLoginResponse> {
    try {
      const response = await this.httpClient.post<MatrixLoginResponse>('/_matrix/client/r0/login', {
        type: 'm.login.password',
        user: username,
        password: password,
      });
      this.logger.debug(`Результат входа в систему: ${JSON.stringify(response.data)}`);
      this.logger.log(`Пользователь ${username} успешно вошел в Matrix`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Не удалось войти пользователю ${username} в Matrix`, error);
      throw new Error('Не удалось войти в Matrix');
    }
  }
  /**
   * Ищет пользователя в Synapse по email
   */
  async findUserByEmail(email: string): Promise<{ user_id: string; name: string } | null> {
    try {
      const adminToken = await this.loginAdmin();
      this.logger.debug(`Поиск пользователя по email: ${email}`);
      // Ищем пользователя по email в threepids согласно официальной документации
      const response = await this.httpClient.get(`/_synapse/admin/v1/threepid/email/users/${encodeURIComponent(email)}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      this.logger.debug(`Ответ findUserByEmail: ${JSON.stringify(response.data)}`);

      // Если threepid найден, получаем информацию о пользователе
      if (response.data && response.data.user_id) {
        // Извлекаем username из user_id
        const userId = response.data.user_id;
        const username = userId.split(':')[0].substring(1); // Убираем @ и :domain

        return {
          user_id: userId,
          name: username,
        };
      }

      return null;
    } catch (error: any) {
      this.logger.debug(`Ошибка findUserByEmail: ${JSON.stringify(error?.response?.data) || error.message}`);

      // Проверяем, является ли ошибка 404 (пользователь не найден)
      if (error?.response?.status === 404) {
        this.logger.debug(`findUserByEmail: Пользователь не найден для email ${email}`);
        return null;
      }

      // Если другая ошибка - возвращаем null
      return null;
    }
  }

  /**
   * Проверяет доступность username в Matrix
   */
  async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const adminToken = await this.loginAdmin();
      const userId = `@${username}:${this.homeserverUrl.replace('https://', '').replace('http://', '')}`;

      // Пытаемся получить информацию о пользователе
      await this.httpClient.get(`/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      // Если запрос прошел успешно - пользователь существует
      return false; // Недоступен
    } catch (error: any) {
      // Если 404 - пользователь не существует, значит доступен
      if (error.response?.status === 404) {
        return true; // Доступен
      }
      // При других ошибках считаем недоступным
      return false;
    }
  }

  /**
   * Проверяет существование пользователя по email
   */
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const adminToken = await this.loginAdmin();

      // Ищем threepid по email
      const response = await this.httpClient.get(
        `/_synapse/admin/v1/threepid/unbind?address=${encodeURIComponent(email)}&id_server=matrix.org&medium=email`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      // Если threepid найден - email уже используется
      return response.data && response.data.user_id;
    } catch (error: any) {
      // Если threepid не найден - email свободен
      return false;
    }
  }

  getHomeserverUrl(): string {
    return this.homeserverUrl;
  }

  /**
   * Профиль пользователя Synapse Admin API v2 (displayname и т.д.)
   */
  async getSynapseUserProfile(
    matrixUserId: string
  ): Promise<{ displayname?: string; display_name?: string } | null> {
    try {
      const adminToken = await this.loginAdmin();
      const response = await this.httpClient.get<{ displayname?: string; display_name?: string }>(
        `/_synapse/admin/v2/users/${encodeURIComponent(matrixUserId)}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      return response.data ?? null;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        return null;
      }
      this.logger.debug(`getSynapseUserProfile ${matrixUserId}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Отображаемое имя из Synapse или локальная часть MXID.
   */
  async resolveMatrixUserDisplayName(canonicalUserId: string): Promise<string> {
    const profile = await this.getSynapseUserProfile(canonicalUserId);
    const dn = profile?.displayname?.trim() || profile?.display_name?.trim();
    if (dn) {
      return dn;
    }
    const local = canonicalUserId.startsWith('@') ? canonicalUserId.slice(1).split(':')[0] : canonicalUserId;
    return local || canonicalUserId;
  }

  /**
   * Возвращает user_id администратора Matrix
   */
  getAdminUserId(): string {
    return `@${this.adminUsername}:${this.homeserverUrl.replace('https://', '').replace('http://', '')}`;
  }

  /**
   * Создает новую комнату в Matrix
   */
  async createRoom(
    name: string,
    topic?: string,
    isPrivate = true,
    roomType?: string,
    initialState?: any[],
    encrypt = true,
    powerLevels?: any
  ): Promise<string> {
    try {
      const adminToken = await this.loginAdmin();

      const roomConfig: any = {
        name,
        preset: isPrivate ? 'private_chat' : 'public_chat',
        visibility: isPrivate ? 'private' : 'public',
      };

      if (topic) {
        roomConfig.topic = topic;
      }

      if (roomType) {
        roomConfig.creation_content = {
          type: roomType,
        };
      }

      // Подготавливаем initial_state
      const finalInitialState = initialState ? [...initialState] : [];

      // Устанавливаем права доступа через power_level_content_override (рекомендуемый способ)
      // Не добавляем в initial_state, чтобы избежать конфликтов
      if (powerLevels) {
        roomConfig.power_level_content_override = powerLevels;
      }

      // Для приватных комнат включаем сквозное шифрование, если encrypt = true
      if (isPrivate && encrypt) {
        finalInitialState.push({
          type: 'm.room.encryption',
          state_key: '',
          content: {
            algorithm: 'm.megolm.v1.aes-sha2',
          },
        });
      }

      if (finalInitialState.length > 0) {
        roomConfig.initial_state = finalInitialState;
      }

      const response = await this.httpClient.post<CreateRoomResponse>('/_matrix/client/v3/createRoom', roomConfig, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      this.logger.log(`Комната "${name}" успешно создана с ID: ${response.data.room_id}`);
      return response.data.room_id;
    } catch (error: any) {
      this.logger.error(`Не удалось создать комнату "${name}": ${JSON.stringify(error?.response?.data)}`);
      throw new Error('Не удалось создать комнату в Matrix');
    }
  }

  /**
   * Создает пространство (space) в Matrix
   */
  async createSpace(name: string, topic?: string): Promise<string> {
    return this.createRoom(name, topic, true, 'm.space', [
      {
        type: 'm.room.history_visibility',
        state_key: '',
        content: {
          history_visibility: 'invited',
        },
      },
    ]);
  }

  /**
   * Ищет комнаты по имени
   */
  async searchRooms(searchTerm: string): Promise<RoomInfo[]> {
    try {
      const adminToken = await this.loginAdmin();

      const response = await this.httpClient.get<RoomsSearchResponse>(
        `/_synapse/admin/v1/rooms?search_term=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      return response.data.rooms;
    } catch (error: any) {
      this.logger.error(`Не удалось найти комнаты с термином "${searchTerm}": ${JSON.stringify(error?.response?.data)}`);
      return [];
    }
  }

  /**
   * Получает информацию о комнате
   */
  async getRoomInfo(roomId: string): Promise<RoomInfo | null> {
    try {
      const adminToken = await this.loginAdmin();

      const response = await this.httpClient.get<RoomInfo>(`/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      // Если комната не найдена, возвращаем null
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Не удалось получить информацию о комнате ${roomId}: ${JSON.stringify(error?.response?.data)}`);
      throw error;
    }
  }

  /**
   * Получает список участников комнаты
   */
  async getRoomMembers(roomId: string): Promise<string[]> {
    try {
      const adminToken = await this.loginAdmin();

      const response = await this.httpClient.get<RoomMembersResponse>(
        `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/members`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      return response.data.members;
    } catch (error: any) {
      this.logger.error(`Не удалось получить участников комнаты ${roomId}: ${JSON.stringify(error?.response?.data)}`);
      return [];
    }
  }

  /**
   * Проверяет, находится ли пользователь в комнате
   */
  async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    const members = await this.getRoomMembers(roomId);
    return members.includes(userId);
  }

  /**
   * Отправляет текстовое сообщение в комнату от имени администратора.
   * @returns Matrix event_id ($...)
   */
  async sendMessage(roomId: string, message: string): Promise<string> {
    const adminToken = await this.loginAdmin();
    return this.sendMessageWithToken(roomId, message, adminToken);
  }

  /**
   * Отправляет текстовое сообщение в комнату от имени указанного пользователя (по его access token)
   * Используется для отправки сообщений от имени секретаря
   * @returns Matrix event_id ($...)
   */
  async sendMessageWithToken(roomId: string, message: string, accessToken: string): Promise<string> {
    const maxAttempts = 6;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        const response = await this.httpClient.put<MatrixSendEventResponse>(
          `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
          {
            msgtype: 'm.text',
            body: message,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const eventId = response.data?.event_id;
        if (!eventId) {
          throw new Error('Matrix не вернул event_id');
        }

        this.logger.log(`Сообщение отправлено в комнату ${roomId}, event_id=${eventId}`);
        return eventId;
      } catch (error: unknown) {
        lastError = error;
        const err = error as { response?: { status?: number; data?: { errcode?: string; retry_after_ms?: number } } };
        const waitMs = MatrixApiService.extractMatrixRateLimitWaitMs(error);
        if (waitMs !== null && attempt < maxAttempts) {
          this.logger.warn(
            `Matrix rate limit при отправке в ${roomId}, попытка ${attempt}/${maxAttempts}, пауза ${waitMs} мс`
          );
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        this.logger.error(
          `Не удалось отправить сообщение в комнату ${roomId}: ${JSON.stringify(err.response?.data)}`
        );
        throw new Error('Не удалось отправить сообщение');
      }
    }
    this.logger.error(
      `Не удалось отправить сообщение в комнату ${roomId} после ${maxAttempts} попыток: ${JSON.stringify(lastError)}`
    );
    throw new Error('Не удалось отправить сообщение');
  }

  /**
   * Текущие закреплённые события (m.room.pinned_events, пустой state_key).
   */
  async getRoomPinnedEventIds(roomId: string): Promise<string[]> {
    try {
      const adminToken = await this.loginAdmin();
      const response = await this.httpClient.get<MatrixPinnedEventsState>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.pinned_events/`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      const pinned = response.data?.pinned;
      return Array.isArray(pinned) ? pinned.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown } };
      if (err.response?.status === 404) {
        return [];
      }
      if (MatrixApiService.extractMatrixRateLimitWaitMs(error) !== null) {
        throw error;
      }
      this.logger.error(
        `Не удалось прочитать закрепления комнаты ${roomId}: ${JSON.stringify(err.response?.data)}`
      );
      throw new Error('Не удалось прочитать закрепления комнаты');
    }
  }

  /**
   * Устанавливает закрепления комнаты (полная замена содержимого m.room.pinned_events).
   */
  async setRoomPinnedEventIds(roomId: string, eventIds: string[]): Promise<void> {
    try {
      const adminToken = await this.loginAdmin();
      await this.httpClient.put(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.pinned_events/`,
        { pinned: eventIds },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      this.logger.log(`Закрепления комнаты ${roomId} обновлены (${eventIds.length} событий)`);
    } catch (error: unknown) {
      if (MatrixApiService.extractMatrixRateLimitWaitMs(error) !== null) {
        throw error;
      }
      const err = error as { response?: { data?: unknown } };
      this.logger.error(`Не удалось обновить закрепления комнаты ${roomId}: ${JSON.stringify(err.response?.data)}`);
      throw new Error('Не удалось закрепить сообщение в комнате');
    }
  }

  private static readonly MAX_PINNED_EVENTS = 24;

  /**
   * Отправка сообщения и закрепление: новое событие в начале списка, без дубликатов, с ограничением длины.
   * @returns event_id корневого сообщения (для последующих правок через m.replace)
   */
  async sendTextMessageAndPin(roomId: string, plainText: string): Promise<string> {
    const eventId = await this.sendMessage(roomId, plainText);
    const maxPinAttempts = 6;
    for (let attempt = 1; attempt <= maxPinAttempts; attempt++) {
      try {
        const previous = await this.getRoomPinnedEventIds(roomId);
        const merged = [eventId, ...previous.filter((id) => id !== eventId)];
        const capped = merged.slice(0, MatrixApiService.MAX_PINNED_EVENTS);
        await this.setRoomPinnedEventIds(roomId, capped);
        return eventId;
      } catch (error: unknown) {
        const waitMs = MatrixApiService.extractMatrixRateLimitWaitMs(error);
        if (waitMs !== null && attempt < maxPinAttempts) {
          this.logger.warn(
            `Matrix rate limit при закреплении в ${roomId}, попытка ${attempt}/${maxPinAttempts}, пауза ${waitMs} мс`
          );
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Не удалось закрепить сообщение в комнате');
  }

  /**
   * Редактирование текста сообщения (MSC2676): новое событие m.room.message с m.relates_to m.replace.
   * Закреплённый event_id остаётся прежним — клиенты показывают актуальный текст.
   */
  async replaceTextMessage(roomId: string, rootEventId: string, plainText: string): Promise<void> {
    try {
      const adminToken = await this.loginAdmin();
      const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payload: Record<string, unknown> = {
        msgtype: 'm.text',
        body: plainText,
        'm.new_content': {
          msgtype: 'm.text',
          body: plainText,
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: rootEventId,
        },
      };
      await this.httpClient.put<MatrixSendEventResponse>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      this.logger.log(`Сообщение ${rootEventId} в комнате ${roomId} отредактировано (m.replace)`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown } };
      this.logger.error(
        `Не удалось отредактировать сообщение в комнате ${roomId}: ${JSON.stringify(err?.response?.data)}`
      );
      throw new Error('Не удалось отредактировать сообщение в Matrix');
    }
  }

  /**
   * Снимает закрепление с события и редактирует его (Matrix redaction) — анонс исчезает из закрепов и тела.
   */
  async unpinAndRedactRootMessage(roomId: string, rootEventId: string): Promise<void> {
    const previous = await this.getRoomPinnedEventIds(roomId);
    const filtered = previous.filter((id) => id !== rootEventId);
    if (filtered.length !== previous.length) {
      await this.setRoomPinnedEventIds(roomId, filtered);
    }

    try {
      const adminToken = await this.loginAdmin();
      const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await this.httpClient.put(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(rootEventId)}/${txnId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      this.logger.log(`Анонс ${rootEventId} в комнате ${roomId}: снят закреп и выполнен redact`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown } };
      this.logger.error(
        `Не удалось выполнить redact сообщения ${rootEventId} в ${roomId}: ${JSON.stringify(err?.response?.data)}`
      );
      throw new Error('Не удалось удалить сообщение в Matrix');
    }
  }

  /**
   * Присоединяет пользователя к комнате
   */
  async joinRoom(userId: string, roomId: string): Promise<void> {
    try {
      // Проверяем, находится ли пользователь уже в комнате
      const isAlreadyInRoom = await this.isUserInRoom(userId, roomId);
      if (isAlreadyInRoom) {
        this.logger.debug(`Пользователь ${userId} уже находится в комнате ${roomId}, пропускаем присоединение`);
        return;
      }

      const adminToken = await this.loginAdmin();

      await this.httpClient.post(
        `/_synapse/admin/v1/join/${encodeURIComponent(roomId)}`,
        { user_id: userId },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      this.logger.log(`Пользователь ${userId} присоединился к комнате ${roomId}`);
    } catch (error: any) {
      this.logger.error(
        `Не удалось присоединить пользователя ${userId} к комнате ${roomId}: ${JSON.stringify(error?.response?.data)}`
      );
      throw new Error('Не удалось присоединить пользователя к комнате');
    }
  }

  /**
   * Приглашает пользователя в комнату (от имени Matrix-админа, который состоит в комнате).
   * Пользователь увидит приглашение и войдёт сам — в отличие от {@link joinRoom} (force-join).
   */
  async inviteUser(userId: string, roomId: string): Promise<void> {
    try {
      const adminToken = await this.loginAdmin();
      await this.httpClient.post(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`,
        { user_id: userId },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      this.logger.log(`Пользователь ${userId} приглашён в комнату ${roomId}`);
    } catch (error: any) {
      this.logger.error(
        `Не удалось пригласить пользователя ${userId} в комнату ${roomId}: ${JSON.stringify(error?.response?.data)}`
      );
      throw new Error('Не удалось пригласить пользователя в комнату');
    }
  }

  /**
   * Исключает пользователя из комнаты (от имени Matrix-админа с power 100).
   * Используется для вывода секретаря из комнаты по требованию председателя/совета.
   */
  async kickUser(userId: string, roomId: string, reason?: string): Promise<void> {
    try {
      const adminToken = await this.loginAdmin();
      await this.httpClient.post(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/kick`,
        reason ? { user_id: userId, reason } : { user_id: userId },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      this.logger.log(`Пользователь ${userId} исключён из комнаты ${roomId}`);
    } catch (error: any) {
      this.logger.error(
        `Не удалось исключить пользователя ${userId} из комнаты ${roomId}: ${JSON.stringify(error?.response?.data)}`
      );
      throw new Error('Не удалось исключить пользователя из комнаты');
    }
  }

  /**
   * Получает текущие права пользователей в комнате
   */
  async getRoomPowerLevels(roomId: string): Promise<any> {
    try {
      const adminToken = await this.loginAdmin();

      const response = await this.httpClient.get(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Не удалось получить права комнаты ${roomId}: ${JSON.stringify(error?.response?.data)}`);
      return null;
    }
  }

  /**
   * Обновляет права пользователей в комнате
   */
  async updateRoomPowerLevels(roomId: string, powerLevels: any): Promise<void> {
    try {
      const adminToken = await this.loginAdmin();

      await this.httpClient.put(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`,
        powerLevels,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      this.logger.log(`Права в комнате ${roomId} обновлены`);
    } catch (error: any) {
      this.logger.error(`Не удалось обновить права в комнате ${roomId}: ${JSON.stringify(error?.response?.data)}`);
      throw new Error('Не удалось обновить права в комнате');
    }
  }

  /**
   * Добавляет комнату в пространство
   */
  async addRoomToSpace(spaceId: string, roomId: string): Promise<void> {
    try {
      const adminToken = await this.loginAdmin();

      await this.httpClient.put(
        `/_matrix/client/v3/rooms/${encodeURIComponent(spaceId)}/state/m.space.child/${encodeURIComponent(roomId)}`,
        {
          via: [this.homeserverUrl.replace('https://', '').replace('http://', '')],
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      this.logger.log(`Комната ${roomId} добавлена в пространство ${spaceId}`);
    } catch (error: any) {
      this.logger.error(
        `Не удалось добавить комнату ${roomId} в пространство ${spaceId}: ${JSON.stringify(error?.response?.data)}`
      );
      throw new Error('Не удалось добавить комнату в пространство');
    }
  }

  private static parseMxcUri(uri: string): { serverName: string; mediaId: string } | null {
    if (!uri.startsWith('mxc://')) {
      return null;
    }
    const rest = uri.slice('mxc://'.length);
    const slash = rest.indexOf('/');
    if (slash < 0) {
      return null;
    }
    const serverName = rest.slice(0, slash);
    const mediaId = rest.slice(slash + 1);
    if (!serverName || !mediaId) {
      return null;
    }
    return { serverName, mediaId };
  }

  /**
   * Страница истории комнаты (dir=b — от конца к началу; без from — с последних событий).
   */
  async fetchRoomMessagesPage(
    roomId: string,
    accessToken: string,
    options: { dir: 'b' | 'f'; from?: string; limit?: number }
  ): Promise<MatrixRoomMessagesPage> {
    const limit = options.limit ?? 100;
    const params: Record<string, string | number> = { dir: options.dir, limit };
    if (options.from) {
      params.from = options.from;
    }
    const response = await this.httpClient.get<MatrixRoomMessagesPage>(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      }
    );
    const data = response.data;
    return {
      chunk: Array.isArray(data.chunk) ? data.chunk : [],
      start: typeof data.start === 'string' ? data.start : undefined,
      end: typeof data.end === 'string' ? data.end : undefined,
    };
  }

  /**
   * Скачивание медиа по mxc:// (голосовые и файлы Matrix).
   */
  async downloadMxcAsBuffer(mxcUri: string, accessToken: string): Promise<Buffer | null> {
    const parsed = MatrixApiService.parseMxcUri(mxcUri);
    if (!parsed) {
      this.logger.warn(`Некорректный MXC URI: ${mxcUri}`);
      return null;
    }
    try {
      const path = `/_matrix/client/v1/media/download/${encodeURIComponent(parsed.serverName)}/${encodeURIComponent(
        parsed.mediaId
      )}`;
      const response = await this.httpClient.get<ArrayBuffer>(path, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
        maxContentLength: 25 * 1024 * 1024,
        maxBodyLength: 25 * 1024 * 1024,
        timeout: 120000,
      });
      return Buffer.from(response.data);
    } catch (error: unknown) {
      this.logger.warn(`Скачивание MXC не удалось (${mxcUri}): ${String(error)}`);
      return null;
    }
  }
}
