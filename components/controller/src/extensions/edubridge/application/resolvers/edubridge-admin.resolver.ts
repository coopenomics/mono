import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import { canAccess } from '../access/edubridge-access-matrix';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import {
  EduAccessTaskDTO,
  EduConnectorBindingDTO,
  EduMemberCardDTO,
  EduMemberRowDTO,
  EduQueueFilterInputDTO,
  EduLearnerAccountDTO,
  EduMarkLearnerRemovedInputDTO,
  EduRetryEnrollmentCloseInputDTO,
  EduRetryTaskInputDTO,
  EduSetConnectorEnabledInputDTO,
  EduSetConnectorCredentialsInputDTO,
} from '../dto/edu-admin.dto';
import { EduAccessCarrier } from '../../domain/enums';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeAdminService } from '../services/edubridge-admin.service';
import { EdubridgeEnrollmentService } from '../services/edubridge-enrollment.service';
import { EduEnrollmentDTO } from '../dto/edu-enrollment.dto';
import { EdubridgeAttentionService } from '../services/edubridge-attention.service';
import { EduAttentionDTO } from '../dto/edu-attention.dto';

const coop = () => platformSettings().coopname;

/**
 * Стол администратора и владельца. Контакты пайщиков вырезаются здесь, на
 * уровне данных: резолвер показывает их только при `EduContacts:read`.
 */
@Resolver()
@Injectable()
export class EdubridgeAdminResolver {
  constructor(
    private readonly admin: EdubridgeAdminService,
    private readonly attention: EdubridgeAttentionService,
    private readonly enrollments: EdubridgeEnrollmentService
  ) {}

  // Права проверяются по каждому числу отдельно: недоступный раздел даёт ноль.
  @Query(() => EduAttentionDTO, { name: 'edubridgeAttention', description: 'Сколько дел ждёт администратора — числа на пунктах меню' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  edubridgeAttention(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduAttentionDTO> {
    return this.attention.summary(coop(), m.roles);
  }

  @Query(() => [EduMemberRowDTO], { name: 'edubridgeMembers', description: 'Ученики приложения: у каждого свои обучающиеся и подписки' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduRegistry', 'read')
  edubridgeMembers(@Args('search', { type: () => String, nullable: true }) search?: string): Promise<EduMemberRowDTO[]> {
    return this.admin.members(coop(), search ?? undefined);
  }

  @Query(() => EduMemberCardDTO, { name: 'edubridgeMemberCard', description: 'Сводная карточка пайщика: обучающиеся, курсы, оплаты, выдача' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduRegistry', 'read')
  edubridgeMemberCard(@CurrentEduMember() m: IEdubridgeMembership, @Args('username', { type: () => String }) username: string): Promise<EduMemberCardDTO> {
    return this.admin.memberCard(coop(), username, canAccess(m.roles, 'EduContacts', 'read'));
  }

  @Query(() => [EduAccessTaskDTO], { name: 'edubridgeQueue', description: 'Очередь выдачи доступа и застрявшие задачи' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduQueue', 'read')
  edubridgeQueue(@Args('filter', { nullable: true }) filter?: EduQueueFilterInputDTO): Promise<EduAccessTaskDTO[]> {
    return this.admin.queue(coop(), filter?.statuses);
  }

  @Mutation(() => EduAccessTaskDTO, { name: 'edubridgeRetryTask', description: 'Повторить задачу выдачи/отзыва доступа' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduQueue', 'manage')
  edubridgeRetryTask(@Args('data') data: EduRetryTaskInputDTO): Promise<EduAccessTaskDTO> {
    return this.admin.retry(coop(), data.task_id);
  }

  @Mutation(() => EduLearnerAccountDTO, { name: 'edubridgeMarkLearnerRemoved', description: 'Отметить, что аккаунт обучающегося удалён с площадки' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduQueue', 'manage')
  edubridgeMarkLearnerRemoved(@Args('data') data: EduMarkLearnerRemovedInputDTO): Promise<EduLearnerAccountDTO> {
    return this.admin.markLearnerRemoved(coop(), data.learner_id);
  }

  @Mutation(() => EduEnrollmentDTO, { name: 'edubridgeRetryEnrollmentClose', description: 'Повторить закрытие подписки, которая не закрылась при выходе пайщика из кооператива' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduQueue', 'manage')
  async edubridgeRetryEnrollmentClose(@Args('data') data: EduRetryEnrollmentCloseInputDTO): Promise<EduEnrollmentDTO> {
    const saved = await this.enrollments.retryClose(coop(), data.enrollment_id);
    return new EduEnrollmentDTO(saved, await this.enrollments.courseOf(saved));
  }

  @Query(() => [EduConnectorBindingDTO], { name: 'edubridgeConnectors', description: 'Площадки и их состояние (ключи не выдаются)' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduConnector', 'manage')
  edubridgeConnectors(): Promise<EduConnectorBindingDTO[]> {
    return this.admin.connectorsState(coop());
  }

  @Mutation(() => EduConnectorBindingDTO, { name: 'edubridgeCheckConnector', description: 'Проверить площадку сейчас' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduConnector', 'manage')
  edubridgeCheckConnector(@Args('carrier', { type: () => EduAccessCarrier }) carrier: EduAccessCarrier): Promise<EduConnectorBindingDTO> {
    return this.admin.checkConnector(coop(), carrier);
  }

  @Mutation(() => EduConnectorBindingDTO, { name: 'edubridgeSetConnectorEnabled', description: 'Включить или выключить площадку' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduConnector', 'manage')
  edubridgeSetConnectorEnabled(@Args('data') data: EduSetConnectorEnabledInputDTO): Promise<EduConnectorBindingDTO> {
    return this.admin.setConnectorEnabled(coop(), data.carrier, data.enabled);
  }

  @Mutation(() => EduConnectorBindingDTO, { name: 'edubridgeSetConnectorCredentials', description: 'Задать ключи подключения площадки (владелец); значения шифруются и наружу не выдаются' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduConnector', 'manage')
  edubridgeSetConnectorCredentials(@Args('data') data: EduSetConnectorCredentialsInputDTO): Promise<EduConnectorBindingDTO> {
    return this.admin.setConnectorCredentials(coop(), data.carrier, data.values);
  }
}
