import { Inject, Injectable } from '@nestjs/common';
import { HttpApiError } from '@coopenomics/extension-kit';
import httpStatus from 'http-status';
import type { InnerTransactResult } from '@coopenomics/innercoop';
import { CAPITAL_BLOCKCHAIN_PORT, CapitalBlockchainPort } from '../../domain/interfaces/capital-blockchain.port';
import { ProjectRole } from '../../domain/enums/role-request.enum';
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
 * Допуск к роли на компоненте: заявки пайщиков, приглашения мастера,
 * решения по ним и изменение утверждённой ставки часа.
 *
 * Операции подписываются от имени кооператива, поэтому имя действующего лица
 * приходит в данных операции. Контракт сверяет его с реестром проекта, а здесь
 * проверяется, что действующее лицо — это тот, кто вошёл в систему: иначе один
 * пайщик подавал бы заявки и принимал решения за другого.
 */
@Injectable()
export class RolesManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort
  ) {}

  async requestProjectRole(data: RequestProjectRoleInputDTO, actor: string): Promise<InnerTransactResult> {
    this.checkActor(actor, data.username, 'Заявку на допуск подаёт пайщик от своего имени');

    return await this.capitalBlockchainPort.requestProjectRole({
      ...data,
      description: data.description ?? '',
    });
  }

  async approveProjectRole(data: ApproveProjectRoleInputDTO, actor: string): Promise<InnerTransactResult> {
    this.checkActor(actor, data.master, 'Решение по заявке принимает мастер компонента');

    return await this.capitalBlockchainPort.approveProjectRole(data);
  }

  async declineProjectRole(data: DeclineProjectRoleInputDTO, actor: string): Promise<InnerTransactResult> {
    this.checkActor(actor, data.master, 'Решение по заявке принимает мастер компонента');

    return await this.capitalBlockchainPort.declineProjectRole(data);
  }

  async inviteProjectRole(data: InviteProjectRoleInputDTO, actor: string): Promise<InnerTransactResult> {
    this.checkActor(actor, data.master, 'Приглашение отправляет мастер компонента');

    if (data.candidate === data.master && data.role !== ProjectRole.MASTER)
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Мастер компонента не приглашает сам себя');

    return await this.capitalBlockchainPort.inviteProjectRole({
      ...data,
      description: data.description ?? '',
    });
  }

  async acceptProjectRoleInvite(
    data: AcceptProjectRoleInviteInputDTO,
    actor: string
  ): Promise<InnerTransactResult> {
    this.checkActor(actor, data.username, 'Принять приглашение может только тот, кому оно адресовано');

    return await this.capitalBlockchainPort.acceptProjectRoleInvite(data);
  }

  async declineProjectRoleInvite(
    data: DeclineProjectRoleInviteInputDTO,
    actor: string
  ): Promise<InnerTransactResult> {
    this.checkActor(actor, data.username, 'Отказаться от приглашения может только тот, кому оно адресовано');

    return await this.capitalBlockchainPort.declineProjectRoleInvite(data);
  }

  async requestRateUpdate(data: RequestRateUpdateInputDTO, actor: string): Promise<InnerTransactResult> {
    this.checkActor(actor, data.username, 'Заявку на новую ставку подаёт пайщик от своего имени');

    return await this.capitalBlockchainPort.requestRateUpdate({
      ...data,
      description: data.description ?? '',
    });
  }

  /**
   * Сверяет вошедшего пайщика с действующим лицом операции.
   */
  private checkActor(actor: string, expected: string, message: string): void {
    if (actor !== expected) throw new HttpApiError(httpStatus.FORBIDDEN, message);
  }
}
