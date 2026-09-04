import { Injectable, Inject, Logger } from '@nestjs/common';
import httpStatus from 'http-status';
import { tokenTypes } from '~/types/token.types';
import { Bytes, Checksum256, Signature } from '@wharfkit/antelope';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { BLOCKCHAIN_PORT, BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class AuthDomainService {
  private readonly logger = new Logger(AuthDomainService.name);

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    private readonly tokenApplicationService: TokenApplicationService,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService
  ) {}
  async loginUserWithSignature(email: string, now: string, signature: string) {
    const user = await this.userDomainService.getUserByEmail(email);

    if (!user) {
      throw new HttpApiError(httpStatus.UNAUTHORIZED, 'Пользователь не найден');
    }

    const bytes = Bytes.fromString(now, 'utf8');
    const checksum = Checksum256.hash(bytes);
    const wharf_signature = Signature.from(signature);
    const publicKey = wharf_signature.recoverDigest(checksum);

    const info = await this.blockchainPort.getInfo();
    const blockchainDate = new Date(info.head_block_time).getTime();
    const userData = new Date(now).getTime();

    const differenceInSeconds = (blockchainDate - userData) / 1000;

    if (differenceInSeconds > 30) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Время подписи и время блокчейна превышает допустимое расхождение');
    }

    if (user.is_registered) {
      try {
        const blockchainAccount = await this.blockchainPort.getAccount(user.username);
        const hasKey = this.blockchainPort.hasActiveKey(blockchainAccount, publicKey.toString());
        if (!hasKey) throw new HttpApiError(httpStatus.UNAUTHORIZED, 'Неверный приватный ключ');
      } catch (e) {
        throw new HttpApiError(httpStatus.UNAUTHORIZED, 'Неверный приватный ключ');
      }
    } else {
      //если пользователь еще не зарегистрирован в блокчейне, то проверяем временный ключ, который установлен в объекте его аккаунта
      if (user.public_key != publicKey.toString())
        throw new HttpApiError(httpStatus.UNAUTHORIZED, 'Неверный приватный ключ');
    }

    return user;
  }

  /**
   * Подтвердить почту по токену из письма.
   *
   * Пайщика ищем СНАЧАЛА по обычному id и только потом по legacy mongo id — ровно
   * как в {@link resetKey}. Раньше здесь был единственный `getUserByLegacyMongoId`,
   * хотя токен выпускается на `user.id` (см. `generateVerifyEmailToken`): у всех,
   * кто зарегистрировался после переезда с MongoDB, подтверждение падало всегда, и
   * на фронт уходило неразличимое `Email verification failed`. Отсюда и общий фон:
   * подтверждённых почт в системе фактически нет.
   *
   * Причину отказа не глушим в одно сообщение: истёкшую ссылку пайщик перевыпустит
   * сам, а «ссылка недействительна» шлёт его в поддержку — это разные исходы.
   */
  async verifyEmail(verifyEmailToken: string) {
    const verifyEmailTokenDoc = await this.tokenApplicationService
      .verifyToken({
        token: verifyEmailToken,
        types: [tokenTypes.VERIFY_EMAIL],
      })
      .catch((error: any) => {
        this.logger.warn(`verify-email: токен не принят — ${error?.message ?? error}`);
        throw new HttpApiError(
          httpStatus.UNAUTHORIZED,
          'Ссылка подтверждения недействительна или истекла. Запросите новую в личном кабинете.'
        );
      });

    let user = await this.userDomainService.findUserById(verifyEmailTokenDoc.userId);
    if (!user) {
      user = await this.userDomainService.findUserByLegacyMongoId(verifyEmailTokenDoc.userId);
    }
    if (!user) {
      this.logger.warn(`verify-email: пайщик по токену не найден (userId=${verifyEmailTokenDoc.userId})`);
      throw new HttpApiError(httpStatus.UNAUTHORIZED, 'Пользователь по ссылке подтверждения не найден.');
    }

    // Одноразовость: все выпущенные ссылки гасим, включая ту, по которой пришли.
    await this.tokenApplicationService.deleteTokens({ userId: user.id, type: tokenTypes.VERIFY_EMAIL });
    await this.userDomainService.updateUserById(user.id, { is_email_verified: true });
    this.logger.log(`verify-email: почта подтверждена пайщиком ${user.username}`);
  }
}
