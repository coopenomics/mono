import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { canAccess } from '../access/edubridge-access-matrix';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import {
  EduAccessTaskDTO,
  EduAdminDTO,
  EduAdminInputDTO,
  EduConnectorBindingDTO,
  EduMemberCardDTO,
  EduMemberRowDTO,
  EduQueueFilterInputDTO,
  EduRetryTaskInputDTO,
  EduSetConnectorEnabledInputDTO,
} from '../dto/edu-admin.dto';
import { EduAccessCarrier } from '../../domain/enums';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeAdminService } from '../services/edubridge-admin.service';

const coop = () => platformSettings().coopname;

/**
 * Стол администратора и владельца. Контакты пайщиков вырезаются здесь, на
 * уровне данных: резолвер показывает их только при `EduContacts:read`.
 */
@Resolver()
@Injectable()
export class EdubridgeAdminResolver {
  constructor(private readonly admin: EdubridgeAdminService) {}

  @Query(() => [EduMemberRowDTO], { name: 'edubridgeMembers', description: 'Реестр пайщиков приложения' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduRegistry', 'read')
  edubridgeMembers(@Args('search', { type: () => String, nullable: true }) search?: string): Promise<EduMemberRowDTO[]> {
    return this.admin.members(coop(), search ?? undefined);
  }

  @Query(() => EduMemberCardDTO, { name: 'edubridgeMemberCard', description: 'Сводная карточка пайщика: обучающиеся, курсы, оплаты, выдача' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduRegistry', 'read')
  edubridgeMemberCard(@CurrentEduMember() m: IEdubridgeMembership, @Args('username', { type: () => String }) username: string): Promise<EduMemberCardDTO> {
    return this.admin.memberCard(coop(), username, canAccess(m.roles, 'EduContacts', 'read'));
  }

  @Query(() => [EduAccessTaskDTO], { name: 'edubridgeQueue', description: 'Очередь выдачи доступа и застрявшие задачи' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduQueue', 'read')
  edubridgeQueue(@Args('filter', { nullable: true }) filter?: EduQueueFilterInputDTO): Promise<EduAccessTaskDTO[]> {
    return this.admin.queue(coop(), filter?.statuses);
  }

  @Mutation(() => EduAccessTaskDTO, { name: 'edubridgeRetryTask', description: 'Повторить задачу выдачи/отзыва доступа' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduQueue', 'manage')
  edubridgeRetryTask(@Args('data') data: EduRetryTaskInputDTO): Promise<EduAccessTaskDTO> {
    return this.admin.retry(coop(), data.task_id);
  }

  @Query(() => [EduConnectorBindingDTO], { name: 'edubridgeConnectors', description: 'Площадки и их состояние (ключи не выдаются)' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduConnector', 'manage')
  edubridgeConnectors(): Promise<EduConnectorBindingDTO[]> {
    return this.admin.connectorsState(coop());
  }

  @Mutation(() => EduConnectorBindingDTO, { name: 'edubridgeCheckConnector', description: 'Проверить площадку сейчас' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduConnector', 'manage')
  edubridgeCheckConnector(@Args('carrier', { type: () => EduAccessCarrier }) carrier: EduAccessCarrier): Promise<EduConnectorBindingDTO> {
    return this.admin.checkConnector(coop(), carrier);
  }

  @Mutation(() => EduConnectorBindingDTO, { name: 'edubridgeSetConnectorEnabled', description: 'Включить или выключить площадку' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduConnector', 'manage')
  edubridgeSetConnectorEnabled(@Args('data') data: EduSetConnectorEnabledInputDTO): Promise<EduConnectorBindingDTO> {
    return this.admin.setConnectorEnabled(coop(), data.carrier, data.enabled);
  }

  @Query(() => [EduAdminDTO], { name: 'edubridgeAdmins', description: 'Администраторы приложения' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAdmin', 'manage')
  edubridgeAdmins(): Promise<EduAdminDTO[]> {
    return this.admin.listAdmins(coop());
  }

  @Mutation(() => EduAdminDTO, { name: 'edubridgeAppointAdmin', description: 'Назначить администратора' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAdmin', 'manage')
  async edubridgeAppointAdmin(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduAdminInputDTO): Promise<EduAdminDTO> {
    return this.admin.appoint(coop(), data.username, m.username as string);
  }

  @Mutation(() => Boolean, { name: 'edubridgeDismissAdmin', description: 'Снять администратора' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAdmin', 'manage')
  edubridgeDismissAdmin(@Args('data') data: EduAdminInputDTO): Promise<boolean> {
    return this.admin.dismiss(coop(), data.username);
  }
}
