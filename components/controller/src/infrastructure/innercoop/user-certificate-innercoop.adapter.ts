import { Injectable } from '@nestjs/common';
import type { IUserCertificatePort, InnerUserCertificate } from '@coopenomics/innercoop';
import { UserCertificateInteractor } from '~/application/user/interactors/user-certificate.interactor';

/** Реализация `IUserCertificatePort` поверх сборки сертификата в ядре. */
@Injectable()
export class UserCertificateInnercoopAdapter implements IUserCertificatePort {
  constructor(private readonly userCertificateInteractor: UserCertificateInteractor) {}

  async getCertificateByUsername(username: string): Promise<InnerUserCertificate | null> {
    return this.userCertificateInteractor.getCertificateByUsername(username);
  }
}
