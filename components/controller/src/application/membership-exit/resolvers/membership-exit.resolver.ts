import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { MembershipExitApplicationGenerateDocumentInputDTO } from '~/application/document/documents-dto/membership-exit-application-document.dto';
import { MembershipExitDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/membership-exit-decision-document.dto';
import { MembershipExitService } from '../services/membership-exit.service';
import { CreateMembershipExitInputDTO } from '../dto/create-membership-exit-input.dto';
import { MembershipExitResultDTO } from '../dto/membership-exit-result.dto';
import { MembershipExitReturnPreviewDTO } from '../dto/membership-exit-return-preview.dto';
import { MembershipExitDTO } from '../dto/membership-exit.dto';

/**
 * GraphQL резолвер выхода пайщика из кооператива.
 */
@Resolver()
export class MembershipExitResolver {
  constructor(private readonly membershipExitService: MembershipExitService) {}

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateMembershipExitApplication',
    description: 'Сгенерировать документ заявления о выходе из кооператива.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard)
  async generateMembershipExitApplication(
    @Args('data', { type: () => MembershipExitApplicationGenerateDocumentInputDTO })
    data: MembershipExitApplicationGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.membershipExitService.generateMembershipExitApplication(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateMembershipExitDecision',
    description: 'Сгенерировать документ решения собрания совета о выходе пайщика.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateMembershipExitDecision(
    @Args('data', { type: () => MembershipExitDecisionGenerateDocumentInputDTO })
    data: MembershipExitDecisionGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.membershipExitService.generateMembershipExitDecision(data, options);
  }

  @Mutation(() => MembershipExitResultDTO, {
    name: 'createMembershipExit',
    description:
      'Подать подписанное заявление на выход из кооператива. Запускает рассмотрение советом и последующий возврат паевого взноса.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard)
  async createMembershipExit(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('data', { type: () => CreateMembershipExitInputDTO }) data: CreateMembershipExitInputDTO
  ): Promise<MembershipExitResultDTO> {
    return this.membershipExitService.createMembershipExit(data, currentUser);
  }

  @Mutation(() => MembershipExitResultDTO, {
    name: 'confirmMembershipExit',
    description:
      'Подтвердить выход из кооператива по ссылке из письма. Проверяет токен и отправляет ранее подписанное заявление в блокчейн.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmMembershipExit(
    @Args('token', { type: () => String }) token: string
  ): Promise<MembershipExitResultDTO> {
    return this.membershipExitService.confirmMembershipExit(token);
  }

  @Mutation(() => Boolean, {
    name: 'cancelMembershipExit',
    description: 'Отменить заявление на выход до подтверждения по email.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard)
  async cancelMembershipExit(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('username', { type: () => String }) username: string
  ): Promise<boolean> {
    return this.membershipExitService.cancelMembershipExit(coopname, username, currentUser);
  }

  @Query(() => MembershipExitDTO, {
    name: 'membershipExit',
    nullable: true,
    description:
      'Текущий процесс выхода пайщика из кооператива (статус заявления и планируемая сумма возврата). null — активного выхода нет.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async membershipExit(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('username', { type: () => String }) username: string
  ): Promise<MembershipExitDTO | null> {
    const isOperator = currentUser.role === 'chairman' || currentUser.role === 'member';
    if (!isOperator && username !== currentUser.username) {
      throw new ForbiddenException('Доступен только собственный статус выхода');
    }
    return this.membershipExitService.getMembershipExit(coopname, username);
  }

  @Query(() => MembershipExitReturnPreviewDTO, {
    name: 'membershipExitReturnPreview',
    description:
      'Предварительный расчёт суммы возврата паевого взноса при выходе пайщика (минимальный + целевой паевой). Ориентир для пайщика; итог фиксирует совет.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async membershipExitReturnPreview(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('username', { type: () => String }) username: string
  ): Promise<MembershipExitReturnPreviewDTO> {
    const isOperator = currentUser.role === 'chairman' || currentUser.role === 'member';
    if (!isOperator && username !== currentUser.username) {
      throw new ForbiddenException('Доступен только собственный расчёт возврата');
    }
    return this.membershipExitService.getReturnPreview(coopname, username);
  }
}
