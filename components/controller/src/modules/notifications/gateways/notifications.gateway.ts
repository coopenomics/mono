import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { io } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import config from '~/config/config';
import { NotificationsService } from '../services/notifications.service';
import { CurrentUser } from '~/modules/auth/decorators/current-user.decorator';
import { WebSocketJwtAuthGuard } from '~/modules/auth/guards/websocket-jwt-auth.guard';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/notifications',
})
@Injectable()
@UseGuards(WebSocketJwtAuthGuard)
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);
  private novuConnections = new Map<string, ClientSocket>();
  private userSockets = new Map<string, Socket>();

  constructor(private readonly notificationsService: NotificationsService) {}

  afterInit() {
    this.logger.log('Notifications WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    // Пользователь уже аутентифицирован через WebSocketJwtAuthGuard
    const user = client.data.user as MonoAccountDomainInterface;

    if (!user) {
      this.logger.warn('User not found in socket context after guard');
      client.disconnect();
      return;
    }

    const subscriberId = client.handshake.query?.subscriberId as string;
    if (!subscriberId) {
      this.logger.warn('Client connected without subscriberId');
      client.disconnect();
      return;
    }

    // Проверяем права доступа
    const expectedSubscriberId = `${config.coopname}-${user.username}`;
    if (subscriberId !== expectedSubscriberId) {
      this.logger.warn(`Access denied: user ${user.username} tried to connect with subscriberId ${subscriberId}`);
      client.disconnect();
      return;
    }

    try {
      this.notificationsService.validateAccess(user, subscriberId);

      client.data.subscriberId = subscriberId;

      this.logger.log(`Client connected: ${subscriberId}`);
      this.userSockets.set(subscriberId, client);

      await this.createNovuConnection(subscriberId, client);
    } catch (error) {
      this.logger.error('Connection validation error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const subscriberId = client.data?.subscriberId;

    if (subscriberId) {
      this.logger.log(`Client disconnected: ${subscriberId}`);

      const novuConnection = this.novuConnections.get(subscriberId);
      if (novuConnection) {
        novuConnection.disconnect();
        this.novuConnections.delete(subscriberId);
      }

      this.userSockets.delete(subscriberId);
    }
  }

  private async createNovuConnection(subscriberId: string, clientSocket: Socket) {
    try {
      const novuSocket = io(config.novu.socket_url, {
        auth: {
          applicationIdentifier: config.novu.app_id,
          subscriberId: subscriberId,
        },
        transports: ['websocket'],
      });

      novuSocket.on('connect', () => {
        this.logger.log(`Connected to NOVU for subscriber: ${subscriberId}`);
      });

      novuSocket.on('disconnect', () => {
        this.logger.log(`Disconnected from NOVU for subscriber: ${subscriberId}`);
      });

      novuSocket.on('error', (error) => {
        this.logger.error(`NOVU error for subscriber ${subscriberId}:`, error);
        clientSocket.emit('error', { message: 'Ошибка соединения с сервисом уведомлений' });
      });

      novuSocket.onAny((event, ...args) => {
        this.logger.debug(`Proxying event from NOVU: ${event} for subscriber: ${subscriberId}`);
        clientSocket.emit(event, ...args);
      });

      this.novuConnections.set(subscriberId, novuSocket);

      clientSocket.onAny((event, ...args) => {
        if (!['connect', 'disconnect', 'error'].includes(event)) {
          this.logger.debug(`Proxying event to NOVU: ${event} for subscriber: ${subscriberId}`);
          novuSocket.emit(event, ...args);
        }
      });
    } catch (error) {
      this.logger.error('Error creating NOVU connection:', error);
      clientSocket.emit('error', { message: 'Ошибка при создании соединения с сервисом уведомлений' });
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong');
  }
}
