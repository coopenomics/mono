import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  DocumentAggregateDTO,
  GeneratedDocumentDTO,
  GqlJwtAuthGuard,
  platformSettings,
  DomainError,
  RequireRight,
  RightsGuard,
  SELF,
} from '@coopenomics/extension-kit';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import {
  EduAssignmentDTO,
  EduAssignmentInputDTO,
  EduSetAssignmentRateInputDTO,
  EduContributionDTO,
  EduContributionDocumentDTO,
  EduDeclineContributionInputDTO,
  EduSignActInputDTO,
  EduSignContractInputDTO,
  EduHoldContributionInputDTO,
  EduSubmitContributionInputDTO,
  EduTeacherContractDTO,
  EduTeacherDTO,
  EduTeacherProfileDTO,
  EduTeacherProfileInputDTO,
  EduLessonDTO,
  EduLessonReportInputDTO,
  EduRevokeContributionInputDTO,
  EduShareWithdrawStatementInputDTO,
  EduTeacherSettlementDTO,
  EduRequestShareReturnInputDTO,
  EduShareReturnDocumentDTO,
} from '../dto/edu-teacher.dto';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';
import { EdubridgeApprovalsService } from '../services/edubridge-approvals.service';
import { EduApprovalDTO } from '../dto/edu-approval.dto';

const coop = () => platformSettings().coopname;

function requireTeacherOffer(m: IEdubridgeMembership): void {
  if (!m.facts.hasTeacherOffer) throw DomainError.forbidden('EDUBRIDGE_TEACHER_OFFER_REQUIRED');
}

/** Стол преподавателя и управление назначениями/взносами администратором. */
@Resolver()
@Injectable()
export class EdubridgeTeacherResolver {
  constructor(
    private readonly teachers: EdubridgeTeacherService,
    private readonly approvals: EdubridgeApprovalsService
  ) {}

  // ── Преподаватель ──────────────────────────────────────────────────────────
  // Профиль — первый шаг подключения: о себе и ставку преподаватель называет
  // до оферты и договора, поэтому подписанной оферты здесь не требуется.
  @Query(() => EduTeacherProfileDTO, { name: 'edubridgeMyTeacherProfile', description: 'Мой профиль преподавателя: рассказ о себе и ставка часа' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  edubridgeMyTeacherProfile(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduTeacherProfileDTO> {
    return this.teachers.profile(coop(), m.username as string);
  }

  @Mutation(() => EduTeacherProfileDTO, { name: 'edubridgeSaveTeacherProfile', description: 'Рассказать о себе и назвать ставку часа' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  edubridgeSaveTeacherProfile(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduTeacherProfileInputDTO): Promise<EduTeacherProfileDTO> {
    return this.teachers.saveProfile(coop(), m.username as string, data);
  }

  // Договор — часть подключения: его подписывают до того, как роль
  // преподавателя (и права стола) выданы, поэтому допуск — по подписанной
  // оферте, а не по матрице прав.
  @Query(() => EduTeacherContractDTO, { nullable: true, name: 'edubridgeMyContract', description: 'Мой договор участия в хозяйственной деятельности' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  async edubridgeMyContract(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduTeacherContractDTO | null> {
    requireTeacherOffer(m);
    const c = await this.teachers.contract(coop(), m.username as string);
    return c ? new EduTeacherContractDTO(c) : null;
  }

  @Mutation(() => EduTeacherContractDTO, { name: 'edubridgeSignContract', description: 'Подписать договор участия в хозяйственной деятельности (первая подпись — преподаватель)' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  async edubridgeSignContract(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSignContractInputDTO): Promise<EduTeacherContractDTO> {
    requireTeacherOffer(m);
    return new EduTeacherContractDTO(
      await this.teachers.signContract(coop(), m.username as string, data.document, data.contract_number, data.hourly_rate)
    );
  }

  @Query(() => [EduAssignmentDTO], { name: 'edubridgeMyAssignments', description: 'Мои назначения' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'read:own', SELF)
  async edubridgeMyAssignments(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduAssignmentDTO[]> {
    const rows = await this.teachers.listAssignments(coop(), m.username as string);
    return rows.map(({ assignment, course }) => new EduAssignmentDTO(assignment, course));
  }

  @Query(() => [EduContributionDTO], { name: 'edubridgeMyContributions', description: 'Мои взносы результатами работы' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'read:own', SELF)
  async edubridgeMyContributions(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduContributionDTO[]> {
    const own = await this.teachers.listContributions(coop(), m.username as string);
    const ownLearners = await this.teachers.learnersByContribution(coop(), own);
    return own.map((c) => new EduContributionDTO(c, ownLearners.get(c.id) ?? null));
  }

  @Query(() => [EduLessonDTO], { name: 'edubridgeMyLessons', description: 'Мои проведённые занятия' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'read:own', SELF)
  async edubridgeMyLessons(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduLessonDTO[]> {
    const lessons = await this.teachers.listLessons(coop(), m.username as string);
    const titles = await this.teachers.courseTitles(coop(), lessons.map((l) => l.course_id));
    return lessons.map((l) => new EduLessonDTO(l, titles.get(l.course_id) ?? ''));
  }

  @Mutation(() => EduLessonDTO, { name: 'edubridgeReportLesson', description: 'Отчитаться о проведённом занятии: материалы и взнос по ставке часа' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'create:own', SELF)
  async edubridgeReportLesson(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduLessonReportInputDTO): Promise<EduLessonDTO> {
    const lesson = await this.teachers.reportLesson(coop(), m.username as string, data);
    const titles = await this.teachers.courseTitles(coop(), [lesson.course_id]);
    return new EduLessonDTO(lesson, titles.get(lesson.course_id) ?? '');
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeRevokeContribution', description: 'Снять удерживаемое заявление по подтверждённой рекламации' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'decide')
  async edubridgeRevokeContribution(@Args('data') data: EduRevokeContributionInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.revokeHeldContribution(coop(), data.contribution_id, data.reason));
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeRidStorageAct', description: 'Сформировать акт передачи материалов занятия на ответственное хранение для подписи' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'create:own', SELF)
  async edubridgeRidStorageAct(@CurrentEduMember() m: IEdubridgeMembership, @Args('contribution_id', { type: () => ID }) id: string): Promise<GeneratedDocumentDTO> {
    return new GeneratedDocumentDTO(await this.teachers.storageAct(coop(), m.username as string, id));
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeHoldContribution', description: 'Передать материалы занятия на ответственное хранение на срок гарантии курса' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'create:own', SELF)
  async edubridgeHoldContribution(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduHoldContributionInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.holdContribution(coop(), m.username as string, data.contribution_id, data.document));
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeRidStatement', description: 'Сформировать заявление о паевом взносе РИД для подписи' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'create:own', SELF)
  async edubridgeRidStatement(@CurrentEduMember() m: IEdubridgeMembership, @Args('contribution_id', { type: () => ID }) id: string): Promise<GeneratedDocumentDTO> {
    return new GeneratedDocumentDTO(await this.teachers.statement(coop(), m.username as string, id));
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeSubmitContribution', description: 'Подать взнос РИД: заявление в цепь и проект решения совету' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'create:own', SELF)
  async edubridgeSubmitContribution(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSubmitContributionInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.submitContribution(coop(), m.username as string, data.contribution_id, data.document));
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeRidAct', description: 'Сформировать акт приёма-передачи для подписи (после решения совета)' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'create:own', SELF)
  async edubridgeRidAct(@CurrentEduMember() m: IEdubridgeMembership, @Args('contribution_id', { type: () => ID }) id: string): Promise<GeneratedDocumentDTO> {
    return new GeneratedDocumentDTO(await this.teachers.act(coop(), m.username as string, id));
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeSignAct', description: 'Подписать акт приёма-передачи (первая подпись — преподаватель)' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'create:own', SELF)
  async edubridgeSignAct(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSignActInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.signAct(coop(), m.username as string, data.contribution_id, data.document));
  }

  @Query(() => EduTeacherSettlementDTO, { name: 'edubridgeMySettlement', description: 'Мой расчёт: принятые взносы и доступное к возврату' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduTeacherWallet', 'read:own', SELF)
  edubridgeMySettlement(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduTeacherSettlementDTO> {
    return this.teachers.settlement(coop(), m.username as string);
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeShareWithdrawStatement', description: 'Сформировать заявление о трансляции паевого взноса из ЦПП «Образование» в ЦПП «Цифровой Кошелёк» для подписи' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduTeacherWallet', 'manage:own', SELF)
  async edubridgeShareWithdrawStatement(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduShareWithdrawStatementInputDTO): Promise<GeneratedDocumentDTO> {
    return new GeneratedDocumentDTO(await this.teachers.shareWithdrawStatement(coop(), m.username as string, data.amount));
  }

  @Mutation(() => EduTeacherSettlementDTO, { name: 'edubridgeRequestShareReturn', description: 'Получить возврат паевого взноса по программе «Образование»: перевод в Цифровой Кошелёк и заявка на возврат по двум подписанным заявлениям' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduTeacherWallet', 'manage:own', SELF)
  edubridgeRequestShareReturn(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduRequestShareReturnInputDTO): Promise<EduTeacherSettlementDTO> {
    return this.teachers.requestShareReturn(coop(), m.username as string, data);
  }

  @Query(() => [EduShareReturnDocumentDTO], { name: 'edubridgeMyShareReturnDocuments', description: 'Заявления моего возврата паевого взноса: о трансляции в Цифровой Кошелёк и о возврате' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduTeacherWallet', 'read:own', SELF)
  async edubridgeMyShareReturnDocuments(@CurrentEduMember() m: IEdubridgeMembership, @Args('return_id', { type: () => ID }) id: string): Promise<EduShareReturnDocumentDTO[]> {
    return (await this.teachers.shareReturnDocuments(coop(), m.username as string, id)).map(({ kind, aggregate }) => new EduShareReturnDocumentDTO(kind, aggregate));
  }

  // ── Администратор / владелец ──────────────────────────────────────────────
  @Query(() => [EduTeacherDTO], { name: 'edubridgeTeachers', description: 'Преподаватели кооператива с договором и числом назначений' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'read:all')
  edubridgeTeachers(): Promise<EduTeacherDTO[]> {
    return this.teachers.listTeachers(coop());
  }

  @Query(() => DocumentAggregateDTO, { name: 'edubridgeTeacherContractDocument', nullable: true, description: 'Подписанный договор участия в хозяйственной деятельности преподавателя' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'read:all')
  async edubridgeTeacherContractDocument(@Args('username', { type: () => String }) username: string): Promise<DocumentAggregateDTO | null> {
    const aggregate = await this.teachers.contractDocument(coop(), username);
    return aggregate ? new DocumentAggregateDTO(aggregate) : null;
  }

  @Query(() => DocumentAggregateDTO, { name: 'edubridgeMyContractDocument', nullable: true, description: 'Мой подписанный договор участия в хозяйственной деятельности' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'read:own', SELF)
  async edubridgeMyContractDocument(@CurrentEduMember() m: IEdubridgeMembership): Promise<DocumentAggregateDTO | null> {
    const aggregate = await this.teachers.contractDocument(coop(), m.username as string);
    return aggregate ? new DocumentAggregateDTO(aggregate) : null;
  }

  @Query(() => [EduApprovalDTO], {
    name: 'edubridgeTeacherApprovals',
    description: 'Договор и приложения преподавателя, которые ждут подписи председателя',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'read:all')
  edubridgeTeacherApprovals(@Args('username', { type: () => String }) username: string): Promise<EduApprovalDTO[]> {
    return this.approvals.pendingForTeacher(coop(), username);
  }

  @Query(() => [EduAssignmentDTO], { name: 'edubridgeAssignments', description: 'Назначения преподавателей кооператива' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'read:all')
  async edubridgeAssignments(): Promise<EduAssignmentDTO[]> {
    const rows = await this.teachers.listAssignments(coop());
    return rows.map(({ assignment, course }) => new EduAssignmentDTO(assignment, course));
  }

  @Mutation(() => EduAssignmentDTO, { name: 'edubridgeCreateAssignment', description: 'Допустить преподавателя к курсу: расписание, ожидаемый результат и период ведения' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'manage')
  async edubridgeCreateAssignment(@Args('data') data: EduAssignmentInputDTO): Promise<EduAssignmentDTO> {
    const a = await this.teachers.createAssignment(coop(), data);
    const rows = await this.teachers.listAssignments(coop(), a.teacher_username);
    return new EduAssignmentDTO(a, rows.find((r) => r.assignment.id === a.id)?.course);
  }

  @Mutation(() => EduAssignmentDTO, { name: 'edubridgeSetAssignmentRate', description: 'Задать ставку часа преподавателя на курсе' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'manage')
  async edubridgeSetAssignmentRate(@Args('data') data: EduSetAssignmentRateInputDTO): Promise<EduAssignmentDTO> {
    const a = await this.teachers.setAssignmentRate(coop(), data.assignment_id, data.hourly_rate);
    const rows = await this.teachers.listAssignments(coop(), a.teacher_username);
    return new EduAssignmentDTO(a, rows.find((r) => r.assignment.id === a.id)?.course);
  }

  @Mutation(() => EduAssignmentDTO, { name: 'edubridgeCloseAssignment', description: 'Снять допуск преподавателя к курсу' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'manage')
  async edubridgeCloseAssignment(@Args('id', { type: () => ID }) id: string): Promise<EduAssignmentDTO> {
    const a = await this.teachers.closeAssignment(coop(), id);
    const rows = await this.teachers.listAssignments(coop(), a.teacher_username);
    return new EduAssignmentDTO(a, rows.find((r) => r.assignment.id === a.id)?.course);
  }

  @Mutation(() => EduTeacherContractDTO, {
    nullable: true,
    name: 'edubridgeTerminateContract',
    description: 'Прекратить договор участия в хозяйственной деятельности по соглашению сторон',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'manage')
  async edubridgeTerminateContract(
    @Args('username', { type: () => String }) username: string,
    @Args('reason', { type: () => String }) reason: string
  ): Promise<EduTeacherContractDTO | null> {
    const c = await this.teachers.terminateContract(coop(), username, reason);
    return c ? new EduTeacherContractDTO(c) : null;
  }

  @Query(() => [EduContributionDTO], { name: 'edubridgeContributions', description: 'Взносы РИД всех преподавателей' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'read:all')
  async edubridgeContributions(): Promise<EduContributionDTO[]> {
    const contributions = await this.teachers.listContributions(coop());
    const learners = await this.teachers.learnersByContribution(coop(), contributions);
    return contributions.map((c) => new EduContributionDTO(c, learners.get(c.id) ?? null));
  }

  @Query(() => [EduContributionDocumentDTO], { name: 'edubridgeContributionDocuments', description: 'Документы взноса результатом работы: заявление, акт хранения, акт приёма-передачи' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'decide')
  async edubridgeContributionDocuments(@Args('contribution_id', { type: () => ID }) id: string): Promise<EduContributionDocumentDTO[]> {
    return (await this.teachers.contributionDocuments(coop(), id)).map(({ kind, aggregate }) => new EduContributionDocumentDTO(kind, aggregate));
  }

  @Query(() => [EduContributionDocumentDTO], { name: 'edubridgeMyContributionDocuments', description: 'Документы моего взноса результатом работы' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'read:own', SELF)
  async edubridgeMyContributionDocuments(@CurrentEduMember() m: IEdubridgeMembership, @Args('contribution_id', { type: () => ID }) id: string): Promise<EduContributionDocumentDTO[]> {
    return (await this.teachers.contributionDocuments(coop(), id, m.username as string)).map(({ kind, aggregate }) => new EduContributionDocumentDTO(kind, aggregate));
  }

  @Mutation(() => EduContributionDTO, { name: 'edubridgeDeclineContribution', description: 'Отклонить взнос РИД с причиной' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduContribution', 'decide')
  async edubridgeDeclineContribution(@Args('data') data: EduDeclineContributionInputDTO): Promise<EduContributionDTO> {
    return new EduContributionDTO(await this.teachers.decline(coop(), data.contribution_id, data.reason));
  }
}
