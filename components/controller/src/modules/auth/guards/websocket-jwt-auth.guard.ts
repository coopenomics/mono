import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import config from '~/config/config';
import { User } from '~/models';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

@Injectable()
export class WebSocketJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();

      // Извлекаем токен из разных источников
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token) {
        return false;
      }

      // Проверяем JWT токен
      const decoded = this.jwtService.verify(token, { secret: config.jwt.secret });
      const user = (await User.findById(decoded.sub)) as MonoAccountDomainInterface;

      if (!user) {
        return false;
      }

      // Сохраняем пользователя в контекст сокета
      client.data.user = user;

      return true;
    } catch (error) {
      console.error('WebSocket JWT Guard error:', error);
      return false;
    }
  }
}
