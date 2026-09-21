import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GeneratedDocumentDTO, GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { EduReturnStatus } from '../../domain/enums';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import {
  EduDeclineReturnInputDTO,
  EduRequestReturnInputDTO,
  EduReturnBalanceDTO,
  EduReturnRequestDTO,
  EduReturnStatementInputDTO,
} from '../dto/edu-return.dto';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeReturnService } from '../services/edubridge-return.service';

const coop = () => platformSettings().coopname;

/** Возврат остатка кошелька программы в паевой взнос: заявление пайщика и согласование кооперативом. */
@Resolver()
@Injectable()
export class EdubridgeReturnResolver {
  constructor(private readonly returns: EdubridgeReturnService) {}

  @Query(() => EduReturnBalanceDTO, { name: 'edubridgeReturnBalance', description: 'Остаток кошелька программы и сумма, доступная для заявления о возврате в паевой взнос' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'read:own')
  async edubridgeReturnBalance(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduReturnBalanceDTO> {
    return new EduReturnBalanceDTO(await this.returns.balance(coop(), m.username as string));
  }

  @Query(() => [EduReturnRequestDTO], { name: 'edubridgeMyReturnRequests', description: 'Мои заявления о возврате членского взноса в паевой взнос' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'read:own')
  async edubridgeMyReturnRequests(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduReturnRequestDTO[]> {
    return (await this.returns.listMine(coop(), m.username as string)).map((r) => new EduReturnRequestDTO(r));
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeReturnStatement', description: 'Сформировать заявление о возврате членского взноса в паевой взнос' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'create:own')
  async edubridgeReturnStatement(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduReturnStatementInputDTO): Promise<GeneratedDocumentDTO> {
    return (await this.returns.statement(coop(), m.username as string, data.amount)) as unknown as GeneratedDocumentDTO;
  }

  @Mutation(() => EduReturnRequestDTO, { name: 'edubridgeRequestReturn', description: 'Подать подписанное заявление о возврате членского взноса в паевой взнос на согласование кооперативу' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'create:own')
  async edubridgeRequestReturn(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduRequestReturnInputDTO): Promise<EduReturnRequestDTO> {
    return new EduReturnRequestDTO(await this.returns.request(coop(), m.username as string, data.amount, data.document));
  }

  @Query(() => [EduReturnRequestDTO], { name: 'edubridgeReturnRequests', description: 'Заявления пайщиков о возврате членского взноса в паевой взнос' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'read:all')
  async edubridgeReturnRequests(
    @Args('status', { type: () => EduReturnStatus, nullable: true }) status?: EduReturnStatus
  ): Promise<EduReturnRequestDTO[]> {
    return (await this.returns.listAll(coop(), status)).map((r) => new EduReturnRequestDTO(r));
  }

  @Mutation(() => EduReturnRequestDTO, { name: 'edubridgeApproveReturn', description: 'Согласовать заявление: остаток кошелька программы переходит в паевой взнос пайщика' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'decide')
  async edubridgeApproveReturn(@CurrentEduMember() m: IEdubridgeMembership, @Args('id', { type: () => ID }) id: string): Promise<EduReturnRequestDTO> {
    return new EduReturnRequestDTO(await this.returns.approve(coop(), id, m.username as string));
  }

  @Mutation(() => EduReturnRequestDTO, { name: 'edubridgeDeclineReturn', description: 'Отклонить заявление о возврате членского взноса в паевой взнос' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'decide')
  async edubridgeDeclineReturn(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduDeclineReturnInputDTO): Promise<EduReturnRequestDTO> {
    return new EduReturnRequestDTO(await this.returns.decline(coop(), data.id, m.username as string, data.reason));
  }
}
