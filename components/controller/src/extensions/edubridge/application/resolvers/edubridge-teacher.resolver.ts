import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GeneratedDocumentDTO, GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import {
  EduAssignmentDTO,
  EduAssignmentInputDTO,
  EduContributionDTO,
  EduContributionDraftInputDTO,
  EduDeclineContributionInputDTO,
  EduSignActInputDTO,
  EduSignAnnexInputDTO,
  EduSignContractInputDTO,
  EduSubmitContributionInputDTO,
  EduTeacherContractDTO,
  EduTeacherSettlementDTO,
} from '../dto/edu-teacher.dto';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';

const coop = () => platformSettings().coopname;

/** Стол преподавателя и управление назначениями/взносами администратором. */
@Resolver()
@Injectable()
export class EdubridgeTeacherResolver {
  constructor(private readonly teachers: EdubridgeTeacherService) {}

  // ── Преподаватель ──────────────────────────────────────────────────────────
  @Query(() => EduTeacherContractDTO, { nullable: true, name: 'edubridgeMyContract', description: 'Мой договор участия в хозяйственной деятельности' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAssignment', 'read:own')
  async edubridgeMyContract(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduTeacherContractDTO | null> {
    const c = await this.teachers.contract(coop(), m.username as string);
    return c ? new EduTeacherContractDTO(c) : null;
  }

  @Mutation(() => EduTeacherContractDTO, { name: 'edubridgeSignContract', description: 'Подписать договор участия в хозяйственной деятельности' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAssignment', 'read:own')
  async edubridgeSignContract(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSignContractInputDTO): Promise<EduTeacherContractDTO> {
    return new EduTeacherContractDTO(await this.teachers.signContract(coop(), m.username as string, data.document, data.contract_number));
  }

  @Query(() => [EduAssignmentDTO], { name: 'edubridgeMyAssignments', description: 'Мои назначения' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAssignment', 'read:own')
  async edubridgeMyAssignments(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduAssignmentDTO[]> {
    const rows = await this.teachers.listAssignments(coop(), m.username as string);
    return rows.map(({ assignment, course }) => new EduAssignmentDTO(assignment, course?.title ?? ''));
  }

  @Mutation(() => EduAssignmentDTO, { name: 'edubridgeSignAnnex', description: 'Подписать приложение к договору по курсу' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAssignment', 'read:own')
  async edubridgeSignAnnex(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSignAnnexInputDTO): Promise<EduAssignmentDTO> {
    const a = await this.teachers.signAnnex(coop(), m.username as string, data.assignment_id, data.document);
    const [row] = await this.teachers.listAssignments(coop(), m.username as string);
    return new EduAssignmentDTO(a, row?.course?.title ?? '');
  }

  @Query(() => [EduContributionDTO], { name: 'edubridgeMyContributions', description: 'Мои взносы результатами работы' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduContribution', 'read:own')
  async edubridgeMyContributions(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduContributionDTO[]> {
    return (await this.teachers.listContributions(coop(), m.username as string)).map((c) => new EduContributionDTO(c));
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeDraftContribution', description: 'Подготовить взнос РИД (черновик)' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduContribution', 'create:own')
  async edubridgeDraftContribution(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduContributionDraftInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.draftContribution(coop(), m.username as string, data));
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeRidStatement', description: 'Сформировать заявление о паевом взносе РИД для подписи' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduContribution', 'create:own')
  async edubridgeRidStatement(@CurrentEduMember() m: IEdubridgeMembership, @Args('contribution_id', { type: () => ID }) id: string): Promise<GeneratedDocumentDTO> {
    return new GeneratedDocumentDTO(await this.teachers.statement(coop(), m.username as string, id));
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeSubmitContribution', description: 'Подать взнос РИД: заявление в цепь и проект решения совету' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduContribution', 'create:own')
  async edubridgeSubmitContribution(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSubmitContributionInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.submitContribution(coop(), m.username as string, data.contribution_id, data.document));
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeRidAct', description: 'Сформировать акт приёма-передачи для подписи (после решения совета)' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduContribution', 'create:own')
  async edubridgeRidAct(@CurrentEduMember() m: IEdubridgeMembership, @Args('contribution_id', { type: () => ID }) id: string): Promise<GeneratedDocumentDTO> {
    return new GeneratedDocumentDTO(await this.teachers.act(coop(), m.username as string, id));
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeSignAct', description: 'Подписать акт приёма-передачи — взнос принимается в паевой фонд' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduContribution', 'create:own')
  async edubridgeSignAct(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSignActInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.signAct(coop(), m.username as string, data.contribution_id, data.document));
  }

  @Query(() => EduTeacherSettlementDTO, { name: 'edubridgeMySettlement', description: 'Мой расчёт: принятые взносы и доступное к возврату' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduTeacherWallet', 'read:own')
  edubridgeMySettlement(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduTeacherSettlementDTO> {
    return this.teachers.settlement(coop(), m.username as string);
  }

  // ── Администратор / владелец ──────────────────────────────────────────────
  @Query(() => [EduAssignmentDTO], { name: 'edubridgeAssignments', description: 'Назначения преподавателей кооператива' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAssignment', 'read:all')
  async edubridgeAssignments(): Promise<EduAssignmentDTO[]> {
    const rows = await this.teachers.listAssignments(coop());
    return rows.map(({ assignment, course }) => new EduAssignmentDTO(assignment, course?.title ?? ''));
  }

  @Mutation(() => EduAssignmentDTO, { name: 'edubridgeCreateAssignment', description: 'Назначить преподавателю курс, расписание, ожидаемый результат и период сдачи' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAssignment', 'manage')
  async edubridgeCreateAssignment(@Args('data') data: EduAssignmentInputDTO): Promise<EduAssignmentDTO> {
    const a = await this.teachers.createAssignment(coop(), data);
    const rows = await this.teachers.listAssignments(coop(), a.teacher_username);
    return new EduAssignmentDTO(a, rows.find((r) => r.assignment.id === a.id)?.course?.title ?? '');
  }

  @Mutation(() => EduAssignmentDTO, { name: 'edubridgeCloseAssignment', description: 'Закрыть назначение' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduAssignment', 'manage')
  async edubridgeCloseAssignment(@Args('id', { type: () => ID }) id: string): Promise<EduAssignmentDTO> {
    const a = await this.teachers.closeAssignment(coop(), id);
    return new EduAssignmentDTO(a, '');
  }

  @Query(() => [EduContributionDTO], { name: 'edubridgeContributions', description: 'Взносы РИД всех преподавателей' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduContribution', 'read:all')
  async edubridgeContributions(): Promise<EduContributionDTO[]> {
    return (await this.teachers.listContributions(coop())).map((c) => new EduContributionDTO(c));
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeDeclineContribution', description: 'Отклонить взнос РИД с причиной' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduContribution', 'decide')
  async edubridgeDeclineContribution(@Args('data') data: EduDeclineContributionInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.decline(coop(), data.contribution_id, data.reason));
  }
}
