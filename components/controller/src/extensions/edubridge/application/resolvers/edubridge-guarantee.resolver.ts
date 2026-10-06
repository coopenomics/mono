import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GeneratedDocumentDTO, GqlJwtAuthGuard, platformSettings, RequireRight, RightsGuard, SELF } from '@coopenomics/extension-kit';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { EduGuaranteeClaimDTO, EduGuaranteeStateDTO, EduGuaranteeStatementInputDTO, EduSubmitGuaranteeClaimInputDTO } from '../dto/edu-guarantee.dto';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeGuaranteeService } from '../services/edubridge-guarantee.service';

const coop = () => platformSettings().coopname;

/** Гарантийные условия подписки глазами участника: срок, заявление и его ход. */
@Resolver()
export class EdubridgeGuaranteeResolver {
  constructor(private readonly guarantee: EdubridgeGuaranteeService) {}

  @Query(() => [EduGuaranteeStateDTO], { name: 'edubridgeMyGuarantees', description: 'Гарантийные условия по моим подпискам и поданные заявления' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'read:own', SELF)
  async edubridgeMyGuarantees(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduGuaranteeStateDTO[]> {
    return (await this.guarantee.statesOf(coop(), m.username as string)).map((s) => new EduGuaranteeStateDTO(s));
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'edubridgeGuaranteeStatement',
    description: 'Сформировать заявление об аннулировании подписки по гарантийным условиям',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'create:own', SELF)
  async edubridgeGuaranteeStatement(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduGuaranteeStatementInputDTO): Promise<GeneratedDocumentDTO> {
    return this.guarantee.statement(coop(), m.username as string, data.enrollment_id, data.reason, data.links ?? []) as unknown as GeneratedDocumentDTO;
  }

  @Mutation(() => EduGuaranteeClaimDTO, {
    name: 'edubridgeSubmitGuaranteeClaim',
    description: 'Подать подписанное заявление об аннулировании подписки по гарантийным условиям — его рассмотрит совет',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'create:own', SELF)
  async edubridgeSubmitGuaranteeClaim(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSubmitGuaranteeClaimInputDTO): Promise<EduGuaranteeClaimDTO> {
    const claim = await this.guarantee.submit(coop(), m.username as string, data.enrollment_id, data.reason, data.links ?? [], data.document as unknown as ISignedDocument);
    return new EduGuaranteeClaimDTO(claim);
  }
}
