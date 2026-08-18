import { Inject, Injectable } from '@nestjs/common';
import { AccountDomainService, ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import {
  UserCertificateDomainService,
  USER_CERTIFICATE_DOMAIN_SERVICE,
} from '~/domain/user/services/user-certificate-domain.service';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';

@Injectable()
export class UserCertificateInteractor {
  constructor(
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
    @Inject(USER_CERTIFICATE_DOMAIN_SERVICE) private readonly userCertificateDomainService: UserCertificateDomainService
  ) {}

  /**
   * Получает сертификат пользователя по имени аккаунта
   * @param username Имя аккаунта пользователя
   * @returns Сертификат пользователя или null
   */
  async getCertificateByUsername(username: string): Promise<UserCertificateDomainInterface | null> {
    const account = await this.accountDomainService.getPrivateAccount(username);
    return this.userCertificateDomainService.createCertificateFromUserData(account);
  }
}
