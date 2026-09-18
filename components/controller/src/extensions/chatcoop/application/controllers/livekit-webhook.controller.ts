import { Controller, Post, Req, Body, Logger, Inject, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { TokenVerifier } from 'livekit-server-sdk';
import { INTEGRATION_SETTINGS_PORT, type IIntegrationSettingsPort } from '@coopenomics/innercoop';
import { SecretaryAgentService } from '../services/secretary-agent.service';
import {
  ExtensionDomainRepository,
  EXTENSION_REPOSITORY,
} from '@coopenomics/extension-kit';
import { matchLivekitRoomToSecretaryEligibleRooms } from '../utils/livekit-room-mapping.util';
import { CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY } from '../../domain/repositories/managed-matrix-room.repository';
import type { ChatcoopManagedMatrixRoomRepository } from '../../domain/repositories/managed-matrix-room.repository';
import {
  CHATCOOP_STATE_REPOSITORY,
  type ChatcoopStateRepository,
} from '../../domain/repositories/chatcoop-state.repository';

/**
 * Интерфейс события webhook от LiveKit (пересланного через chatcoop-proxy)
 */
interface LiveKitWebhookEvent {
  event: string; // 'room_started' | 'room_finished' | 'participant_joined' | 'participant_left' | ...
  room?: {
    name: string; // LiveKit room name (= Matrix room ID)
    sid: string;
    emptyTimeout?: number;
    maxParticipants?: number;
    creationTime?: string;
    numParticipants?: number;
  };
  participant?: {
    identity: string;
    name: string;
    sid: string;
    state?: number;
  };
  id?: string;
  createdAt?: string;
}

/**
 * REST-контроллер для приема forwarded webhook от chatcoop-proxy
 *
 * Маршрут: POST /api/chatcoop/livekit-webhook
 *
 * chatcoop-proxy пересылает webhook события от LiveKit на все зарегистрированные
 * контроллеры кооперативов. Контроллер проверяет, относится ли событие к комнатам
 * данного кооператива, и если да — запускает/останавливает секретаря.
 */
@Controller('v1/extensions/chatcoop')
export class LiveKitWebhookController {
  private readonly logger = new Logger(LiveKitWebhookController.name);

  constructor(
    private readonly secretaryAgentService: SecretaryAgentService,
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(CHATCOOP_STATE_REPOSITORY) private readonly chatcoopState: ChatcoopStateRepository,
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedMatrixRooms: ChatcoopManagedMatrixRoomRepository,
    @Inject(INTEGRATION_SETTINGS_PORT) private readonly integrations: IIntegrationSettingsPort
  ) {}

  /**
   * Событие подписано LiveKit: JWT в `Authorization` выпущен ключом сервера
   * LiveKit (тем же, которым секретарь входит в комнаты) и несёт sha256 тела.
   * Без ключей секретарь всё равно не работает — такие события не принимаем.
   *
   * chatcoop-proxy проверяет подпись у себя и пересылает заголовок как есть,
   * но до обновления пересылал тело пересобранным JSON — хэш тогда не сходится.
   * Подпись и срок токена обязательны; расхождение хэша пока только в журнал.
   */
  private async assertSignedByLiveKit(req: any): Promise<void> {
    const livekit = this.integrations.get<{ api_key?: string; api_secret?: string }>('chatcoop', 'livekit');
    if (!livekit?.api_key || !livekit.api_secret) {
      throw new UnauthorizedException('Вебхук LiveKit не принимается: ключи LiveKit не настроены');
    }
    const token = req.get?.('Authorization') ?? req.headers?.authorization;
    if (!token) throw new UnauthorizedException('Вебхук LiveKit без подписи');

    let claims: { sha256?: string };
    try {
      claims = await new TokenVerifier(livekit.api_key, livekit.api_secret).verify(token);
    } catch {
      throw new UnauthorizedException('Подпись вебхука LiveKit не прошла проверку');
    }

    const raw: string = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body ?? {});
    const hash = createHash('sha256').update(raw, 'utf8').digest('base64');
    if (claims.sha256 !== hash) {
      this.logger.warn('Хэш тела вебхука LiveKit не совпал с подписью — тело изменено при пересылке (обновите chatcoop-proxy)');
    }
  }

  @Post('livekit-webhook')
  async handleWebhook(
    @Req() req: any,
    @Body() body: LiveKitWebhookEvent
  ): Promise<{ status: string }> {
    // Подпись проверяем вне try: отказ должен уйти отправителю как 401, а не
    // превратиться в «ignored».
    await this.assertSignedByLiveKit(req);
    try {
      const event = body;
      this.logger.log(`Получен LiveKit webhook: event=${event.event}, room=${event.room?.name}`);

      const chatcoopConfig = await this.extensionRepository.findByName('chatcoop');
      if (!chatcoopConfig) {
        this.logger.warn('ChatCoop не установлен, игнорируем webhook');
        return { status: 'ignored' };
      }
      const st = await this.chatcoopState.getSingleton();
      if (!st.isInitialized) {
        this.logger.warn('ChatCoop Matrix space не инициализирован (chatcoop_state), игнорируем webhook');
        return { status: 'ignored' };
      }

      const secretaryReady =
        st.secretaryInitialized ||
        (!!st.secretaryMatrixUserId &&
          !!st.secretaryPasswordEncrypted &&
          st.secretaryMatrixUserId.trim().length > 0 &&
          st.secretaryPasswordEncrypted.length > 0);
      if (!secretaryReady) {
        this.logger.warn('Секретарь не готов (chatcoop_state), игнорируем webhook');
        return { status: 'ignored' };
      }

      const roomName = event.room?.name;

      if (!roomName) {
        this.logger.warn('Webhook без имени комнаты, игнорируем');
        return { status: 'ignored' };
      }

      // Только незашифрованные комнаты из реестра (проекты Capital и т.д.); E2EE-комнаты пайщиков/совета исключены
      const secretaryRooms = await this.managedMatrixRooms.findEligibleForSecretaryTranscription();
      const roomRefs = secretaryRooms.map((r) => ({
        matrixRoomId: r.matrixRoomId,
        displayLabel: r.displayLabel,
      }));
      const roomMatch = matchLivekitRoomToSecretaryEligibleRooms(roomName, roomRefs);

      if (!roomMatch.isMatch || !roomMatch.matrixRoomId) {
        this.logger.log(
          `Комната ${roomName} не в реестре транскрипции (или E2EE), игнорируем`
        );
        return { status: 'ignored' };
      }

      const matrixRoomId = roomMatch.matrixRoomId;
      const roomDisplayName = roomMatch.displayName ?? matrixRoomId;

      switch (event.event) {
        case 'room_started':
          this.logger.log(`Комната ${roomName} (${roomDisplayName}) запущена, подключаем секретаря`);
          await this.secretaryAgentService.joinRoom(roomName, matrixRoomId, roomDisplayName);
          break;

        case 'room_finished':
          this.logger.log(`Комната ${roomName} (${roomDisplayName}) завершена, отключаем секретаря`);
          await this.secretaryAgentService.leaveRoom(roomName);
          break;

        case 'participant_joined':
          this.logger.log(
            `Участник ${event.participant?.identity} присоединился к ${roomDisplayName}`
          );
          break;

        case 'participant_left':
          this.logger.log(
            `Участник ${event.participant?.identity} покинул ${roomDisplayName}`
          );
          break;

        default:
          this.logger.log(`Необработанное событие LiveKit: ${event.event}`);
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(`Ошибка обработки LiveKit webhook: ${error}`);
      return { status: 'error' };
    }
  }
}
