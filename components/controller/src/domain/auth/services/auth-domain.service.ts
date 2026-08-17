import { Injectable, Inject } from '@nestjs/common';
import httpStatus from 'http-status';
import { tokenTypes } from '~/types/token.types';
import { Bytes, Checksum256, Signature } from '@wharfkit/antelope';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { BLOCKCHAIN_PORT, BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class AuthDomainService {
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

  async verifyEmail(verifyEmailToken: string) {
    try {
      const verifyEmailTokenDoc = await this.tokenApplicationService.verifyToken({
        token: verifyEmailToken,
        types: [tokenTypes.VERIFY_EMAIL],
      });
      const user = await this.userDomainService.getUserByLegacyMongoId(verifyEmailTokenDoc.userId);
      await this.tokenApplicationService.deleteTokens({ userId: user.id, type: tokenTypes.VERIFY_EMAIL });
      await this.userDomainService.updateUserById(user.id, { is_email_verified: true });
    } catch (error) {
      throw new HttpApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
    }
  }
}
