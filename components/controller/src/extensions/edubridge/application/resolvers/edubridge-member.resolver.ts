import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GeneratedDocumentDTO, GqlJwtAuthGuard, platformSettings, RequireRight, RightsGuard, SELF } from '@coopenomics/extension-kit';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import {
  EduEnrollmentDTO,
  EduRefundPreviewDTO,
  EduQuoteDTO,
  EduQuoteInputDTO,
  EduSubscribeInputDTO,
} from '../dto/edu-enrollment.dto';
import { EduLearnerDTO, EduLearnerInputDTO, EduUpdateLearnerInputDTO } from '../dto/edu-learner.dto';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeEnrollmentService } from '../services/edubridge-enrollment.service';
import { EdubridgeLearnerService } from '../services/edubridge-learner.service';

const coop = () => platformSettings().coopname;

/** Стол пайщика: обучающиеся, подписки, получение доступа. */
@Resolver()
@Injectable()
export class EdubridgeMemberResolver {
  constructor(
    private readonly learners: EdubridgeLearnerService,
    private readonly enrollments: EdubridgeEnrollmentService
  ) {}

  @Query(() => [EduLearnerDTO], { name: 'edubridgeMyLearners', description: 'Мои обучающиеся' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduLearner', 'read:own', SELF)
  async edubridgeMyLearners(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduLearnerDTO[]> {
    const rows = await this.learners.listMine(coop(), m.username as string);
    return rows.map((l) => new EduLearnerDTO(l, { showContact: true }));
  }

  @Mutation(() => EduLearnerDTO, { name: 'edubridgeAddLearner', description: 'Добавить обучающегося — себя или ребёнка' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduLearner', 'manage:own', SELF)
  async edubridgeAddLearner(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduLearnerInputDTO): Promise<EduLearnerDTO> {
    return new EduLearnerDTO(await this.learners.add(coop(), m.username as string, data), { showContact: true });
  }

  @Mutation(() => EduLearnerDTO, { name: 'edubridgeUpdateLearner', description: 'Исправить имя или контакт обучающегося (без повторной оплаты)' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduLearner', 'manage:own', SELF)
  async edubridgeUpdateLearner(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduUpdateLearnerInputDTO): Promise<EduLearnerDTO> {
    return new EduLearnerDTO(await this.learners.update(coop(), m.username as string, data), { showContact: true });
  }

  @Mutation(() => Boolean, { name: 'edubridgeRemoveLearner', description: 'Удалить обучающегося без действующих подписок' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduLearner', 'manage:own', SELF)
  edubridgeRemoveLearner(@CurrentEduMember() m: IEdubridgeMembership, @Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.learners.remove(coop(), m.username as string, id);
  }

  @Query(() => [EduEnrollmentDTO], { name: 'edubridgeMyEnrollments', description: 'Подписки моих обучающихся: курс, доступ, срок' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'read:own', SELF)
  async edubridgeMyEnrollments(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduEnrollmentDTO[]> {
    const rows = await this.enrollments.listMine(coop(), m.username as string);
    return rows.map(({ enrollment, course }) => new EduEnrollmentDTO(enrollment, course));
  }

  @Query(() => EduQuoteDTO, { name: 'edubridgeQuote', description: 'Сумма взноса за период и хватает ли паевого' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'create:own', SELF)
  edubridgeQuote(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduQuoteInputDTO): Promise<EduQuoteDTO> {
    return this.enrollments.quote(coop(), m.username as string, data.learner_id, data.course_id, data.period);
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeConvertStatement', description: 'Сформировать заявление о конвертации паевого взноса в членский' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'create:own', SELF)
  async edubridgeConvertStatement(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduQuoteInputDTO): Promise<GeneratedDocumentDTO> {
    return new GeneratedDocumentDTO(await this.enrollments.statement(coop(), m.username as string, data.learner_id, data.course_id, data.period));
  }

  @Query(() => EduRefundPreviewDTO, { name: 'edubridgeRefundPreview', description: 'Что вернут при отмене подписки' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'read:own', SELF)
  edubridgeRefundPreview(
    @CurrentEduMember() m: IEdubridgeMembership,
    @Args('enrollment_id', { type: () => ID }) id: string
  ): Promise<EduRefundPreviewDTO> {
    return this.enrollments.refundPreview(coop(), m.username as string, id);
  }

  @Mutation(() => EduEnrollmentDTO, { name: 'edubridgeCancelEnrollment', description: 'Отменить подписку с возвратом членского взноса по Положению ЦПП' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'create:own', SELF)
  async edubridgeCancelEnrollment(
    @CurrentEduMember() m: IEdubridgeMembership,
    @Args('enrollment_id', { type: () => ID }) id: string
  ): Promise<EduEnrollmentDTO> {
    const saved = await this.enrollments.cancel(coop(), m.username as string, id);
    return new EduEnrollmentDTO(saved, await this.enrollments.courseOf(saved));
  }

  @Mutation(() => EduEnrollmentDTO, { name: 'edubridgeSubscribe', description: 'Получить доступ: конвертировать паевой в членский и открыть/продлить подписку' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduEnrollment', 'create:own', SELF)
  async edubridgeSubscribe(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSubscribeInputDTO): Promise<EduEnrollmentDTO> {
    const saved = await this.enrollments.subscribe(coop(), m.username as string, data.learner_id, data.course_id, data.period, data.document);
    return new EduEnrollmentDTO(saved, await this.enrollments.courseOf(saved));
  }
}
