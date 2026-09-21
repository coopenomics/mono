import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { EduReturnStatus } from '../../domain/enums';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import {
  EduDeclineReturnInputDTO,
  EduRequestReturnInputDTO,
  EduReturnBalanceDTO,
  EduReturnRequestDTO,
} from '../dto/edu-return.dto';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeReturnService } from '../services/edubridge-return.service';

const coop = () => platformSettings().coopname;

/** Прекращение участия в программе: заявление пайщика и согласование кооперативом; остаток кошелька программы уходит в паевой взнос. */
@Resolver()
@Injectable()
export class EdubridgeReturnResolver {
  constructor(private readonly returns: EdubridgeReturnService) {}

  @Query(() => EduReturnBalanceDTO, { name: 'edubridgeReturnBalance', description: 'Что уйдёт в паевой взнос, если прекратить участие в программе сегодня' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'read:own')
  async edubridgeReturnBalance(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduReturnBalanceDTO> {
    return new EduReturnBalanceDTO(await this.returns.balance(coop(), m.username as string));
  }

  @Query(() => [EduReturnRequestDTO], { name: 'edubridgeMyReturnRequests', description: 'Мои заявления о прекращении участия в программе' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'read:own')
  async edubridgeMyReturnRequests(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduReturnRequestDTO[]> {
    return (await this.returns.listMine(coop(), m.username as string)).map((r) => new EduReturnRequestDTO(r));
  }

  @Mutation(() => EduReturnRequestDTO, { name: 'edubridgeRequestReturn', description: 'Подать подписанное заявление о прекращении участия в программе на согласование кооперативу' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'create:own')
  async edubridgeRequestReturn(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduRequestReturnInputDTO): Promise<EduReturnRequestDTO> {
    return new EduReturnRequestDTO(await this.returns.request(coop(), m.username as string, data.document));
  }

  @Query(() => [EduReturnRequestDTO], { name: 'edubridgeReturnRequests', description: 'Заявления пайщиков о прекращении участия в программе' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'read:all')
  async edubridgeReturnRequests(
    @Args('status', { type: () => EduReturnStatus, nullable: true }) status?: EduReturnStatus
  ): Promise<EduReturnRequestDTO[]> {
    return (await this.returns.listAll(coop(), status)).map((r) => new EduReturnRequestDTO(r));
  }

  @Mutation(() => EduReturnRequestDTO, { name: 'edubridgeApproveReturn', description: 'Согласовать заявление: подписки пайщика закрываются с возвратом по Положению, весь остаток кошелька программы переходит в его паевой взнос, участие в программе прекращается' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'decide')
  async edubridgeApproveReturn(@CurrentEduMember() m: IEdubridgeMembership, @Args('id', { type: () => ID }) id: string): Promise<EduReturnRequestDTO> {
    return new EduReturnRequestDTO(await this.returns.approve(coop(), id, m.username as string));
  }

  @Mutation(() => EduReturnRequestDTO, { name: 'edubridgeDeclineReturn', description: 'Отклонить заявление о прекращении участия в программе' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'decide')
  async edubridgeDeclineReturn(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduDeclineReturnInputDTO): Promise<EduReturnRequestDTO> {
    return new EduReturnRequestDTO(await this.returns.decline(coop(), data.id, m.username as string, data.reason));
  }
}
