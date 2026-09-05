import { Injectable, UnauthorizedException, Inject, Logger } from '@nestjs/common';
import type { RegisteredAccountDomainInterface } from '~/domain/account/interfaces/registeted-account.interface';
import { AccountDomainService } from '~/domain/account/services/account-domain.service';
import { AuthDomainService } from '~/domain/auth/services/auth-domain.service';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { BLOCKCHAIN_PORT, BlockchainPort } from '~/domain/common/ports/blockchain.port';
import type { LoginInputDomainInterface } from '~/domain/auth/interfaces/login-input-domain.interface';
import type { StartResetKeyInputDomainInterface } from '~/domain/auth/interfaces/start-reset-key-input.interface';
import type { ResetKeyInputDomainInterface } from '~/domain/auth/interfaces/reset-key-input.interface';
import type { RefreshInputDomainInterface } from '~/domain/auth/interfaces/refresh-input.interface';
import type { LogoutInputDomainInterface } from '~/domain/auth/interfaces/logout-input-domain.interface';
import { tokenTypes } from '~/types/token.types';
import config from '~/config/config';
import { NotificationSenderService } from '~/application/notification/services/notification-sender.service';
import { Workflows } from '@coopenomics/notifications';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import { LoginTwoFactorService } from '~/application/auth-v2/login-2fa/login-two-factor.service';
import { VaultService } from '~/application/auth-v2/vault/vault.service';

@Injectable()
export class AuthInteractor {
  private readonly logger = new Logger(AuthInteractor.name);

  constructor(
    private readonly accountDomainService: AccountDomainService,
    private readonly notificationSenderService: NotificationSenderService,
    private readonly authDomainService: AuthDomainService,
    private readonly tokenApplicationService: TokenApplicationService,
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    private readonly loginTwoFactor: LoginTwoFactorService,
    private readonly vault: VaultService
  ) {}

  async login(data: LoginInputDomainInterface): Promise<RegisteredAccountDomainInterface> {
    const user = await this.authDomainService.loginUserWithSignature(data.email, data.now, data.signature);

    // Гейт миграции: пайщик с установленным паролем (vault-блоб существует)
    // входит только новым контуром. Иначе «вход только по паролю» держался бы
    // лишь на UI: ключ из vault (или старого keystore) открывал бы обход всей
    // цепочки пароль → 2FA. Не мигрировавшие аккаунты (SDK-интеграции, EMP)
    // этим гейтом не задеваются — у них строки vault нет.
    const migrated = await this.vault.retrieve({ subject_type: 'participant', subject_id: user.username });
    if (migrated) {
      throw new UnauthorizedException(
        'Для аккаунта установлен пароль — вход по подписи ключа отключён, войдите по email и паролю.'
      );
    }

    // 2FA-гейт: легаси-вход по подписи не умеет второй фактор, а выпуск токенов
    // мимо него обесценил бы защиту (пароль → расшифровка ключа → подпись).
    // Пайщик с включённым подтверждением входа входит только новым контуром.
    if (await this.loginTwoFactor.hasEnabledFactorSettings(user.id)) {
      throw new UnauthorizedException(
        'Для аккаунта включено подтверждение входа (2FA) — вход по подписи недоступен, войдите по паролю.'
      );
    }

    const tokens = await this.tokenApplicationService.generateAuthTokens(user.id);
    const account = await this.accountDomainService.getAccount(user.username);

    return {
      account,
      tokens,
    };
  }

  async logout(data: LogoutInputDomainInterface): Promise<void> {
    // Удаляем refresh токен
    if (data.refresh_token) {
      await this.tokenApplicationService.findOneAndDelete(data.refresh_token, tokenTypes.REFRESH);
    }

    // Удаляем access токен (если он передан)
    if (data.access_token) {
      await this.tokenApplicationService.findOneAndDelete(data.access_token, tokenTypes.ACCESS);
    }
  }

  async startResetKey(data: StartResetKeyInputDomainInterface): Promise<void> {
    const email = normalizeUserEmail(data.email);
    const user = await this.userDomainService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    const resetKeyToken = await this.tokenApplicationService.generateResetKeyToken(email, user.id);

    if (!user) {
      throw new Error('User not found');
    }

    const resetUrl = `${config.frontend_url}/${config.coopname}/auth/reset-key?token=${resetKeyToken}`;

    await this.notificationSenderService.sendNotificationToUser(user.username, Workflows.ResetKey.id, { resetUrl });
  }

  async resetKey(data: ResetKeyInputDomainInterface): Promise<void> {
    try {
      const resetKeyTokenDoc = await this.tokenApplicationService.verifyToken({
        token: data.token,
        types: [tokenTypes.RESET_KEY, tokenTypes.INVITE],
      });

      // Сначала пытаемся найти пользователя по обычному ID (для новых пользователей)
      let user = await this.userDomainService.findUserById(resetKeyTokenDoc.userId);

      // Если не найден по обычному ID, пробуем найти по legacy MongoDB ID (для старых пользователей)
      if (!user) {
        user = await this.userDomainService.findUserByLegacyMongoId(resetKeyTokenDoc.userId);
      }

      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }

      await this.blockchainPort.changeKey({
        coopname: config.coopname,
        changer: config.coopname,
        username: user.username,
        public_key: data.public_key,
      });

      await this.userDomainService.updateUserById(user.id, { public_key: data.public_key });

      await this.tokenApplicationService.deleteTokens({ userId: user.id, type: tokenTypes.RESET_KEY });
    } catch (error: any) {
      this.logger.error(`Ошибка сброса ключа: ${error.message}`, error.stack);
      throw new UnauthorizedException('Возникла ошибка при сбросе ключа');
    }
  }

  async refresh(data: RefreshInputDomainInterface): Promise<RegisteredAccountDomainInterface> {
    try {
      const refreshTokenDoc = await this.tokenApplicationService.verifyToken({
        token: data.refresh_token,
        types: [tokenTypes.REFRESH],
      });
      // Сначала пытаемся найти пользователя по обычному ID (для новых пользователей)
      let user = await this.userDomainService.findUserById(refreshTokenDoc.userId);

      // Если не найден по обычному ID, пробуем найти по legacy MongoDB ID (для старых пользователей)
      if (!user) {
        user = await this.userDomainService.findUserByLegacyMongoId(refreshTokenDoc.userId);
      }

      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }

      await this.tokenApplicationService.findOneAndDelete(data.refresh_token, tokenTypes.REFRESH);
      const tokens = await this.tokenApplicationService.generateAuthTokens(user.id);

      const account = await this.accountDomainService.getAccount(user.username);

      return {
        account,
        tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Возникла неизвестная ошибка при обновлении');
    }
  }

  async verifyEmail(verifyEmailToken: string): Promise<void> {
    await this.authDomainService.verifyEmail(verifyEmailToken);
  }
}
