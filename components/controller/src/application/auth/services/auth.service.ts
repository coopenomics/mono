import { Injectable } from '@nestjs/common';
import type { LoginInputDTO } from '../dto/login-input.dto';
import { RegisteredAccountDTO } from '~/application/account/dto/registered-account.dto';
import { AuthInteractor } from '../interactors/auth.interactor';
import type { LogoutInputDTO } from '../dto/logout-input.dto';
import type { StartResetKeyInputDTO } from '../dto/start-reset-key-input.dto';
import type { ResetKeyInputDTO } from '../dto/reset-key-input.dto';
import type { RefreshInputDTO } from '../dto/refresh-input.dto';

@Injectable()
export class AuthService {
  constructor(private readonly authInteractor: AuthInteractor) {}

  async login(data: LoginInputDTO): Promise<RegisteredAccountDTO> {
    const result = await this.authInteractor.login(data);
    return new RegisteredAccountDTO(result);
  }

  async logout(data: LogoutInputDTO): Promise<void> {
    await this.authInteractor.logout(data);
  }

  async startResetKey(data: StartResetKeyInputDTO): Promise<void> {
    await this.authInteractor.startResetKey(data);
  }


  async resetKey(data: ResetKeyInputDTO): Promise<void> {
    await this.authInteractor.resetKey(data);
  }

  async refresh(data: RefreshInputDTO): Promise<RegisteredAccountDTO> {
    const result = await this.authInteractor.refresh(data);
    return new RegisteredAccountDTO(result);
  }

  async verifyEmail(verifyEmailToken: string): Promise<void> {
    await this.authInteractor.verifyEmail(verifyEmailToken);
  }
}
