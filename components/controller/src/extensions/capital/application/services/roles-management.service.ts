import { Injectable } from '@nestjs/common';
import type { InnerTransactResult } from '@coopenomics/innercoop';
import { RolesManagementInteractor } from '../use-cases/roles-management.interactor';
import type {
  AcceptProjectRoleInviteInputDTO,
  ApproveProjectRoleInputDTO,
  DeclineProjectRoleInputDTO,
  DeclineProjectRoleInviteInputDTO,
  InviteProjectRoleInputDTO,
  RequestProjectRoleInputDTO,
  RequestRateUpdateInputDTO,
} from '../dto/roles_management/inputs.dto';

/**
 * Сервис уровня приложения для допусков к роли на компоненте.
 * Обрабатывает запросы от RolesManagementResolver.
 */
@Injectable()
export class RolesManagementService {
  constructor(private readonly rolesManagementInteractor: RolesManagementInteractor) {}

  async requestProjectRole(data: RequestProjectRoleInputDTO, actor: string): Promise<InnerTransactResult> {
    return await this.rolesManagementInteractor.requestProjectRole(data, actor);
  }

  async approveProjectRole(data: ApproveProjectRoleInputDTO, actor: string): Promise<InnerTransactResult> {
    return await this.rolesManagementInteractor.approveProjectRole(data, actor);
  }

  async declineProjectRole(data: DeclineProjectRoleInputDTO, actor: string): Promise<InnerTransactResult> {
    return await this.rolesManagementInteractor.declineProjectRole(data, actor);
  }

  async inviteProjectRole(data: InviteProjectRoleInputDTO, actor: string): Promise<InnerTransactResult> {
    return await this.rolesManagementInteractor.inviteProjectRole(data, actor);
  }

  async acceptProjectRoleInvite(
    data: AcceptProjectRoleInviteInputDTO,
    actor: string
  ): Promise<InnerTransactResult> {
    return await this.rolesManagementInteractor.acceptProjectRoleInvite(data, actor);
  }

  async declineProjectRoleInvite(
    data: DeclineProjectRoleInviteInputDTO,
    actor: string
  ): Promise<InnerTransactResult> {
    return await this.rolesManagementInteractor.declineProjectRoleInvite(data, actor);
  }

  async requestRateUpdate(data: RequestRateUpdateInputDTO, actor: string): Promise<InnerTransactResult> {
    return await this.rolesManagementInteractor.requestRateUpdate(data, actor);
  }
}
