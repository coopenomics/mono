import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GeneratedDocumentDTO, GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import {
  EduEnrollmentDTO,
  EduQuoteDTO,
  EduQuoteInputDTO,
  EduSubscribeInputDTO,
} from '../dto/edu-enrollment.dto';
import { EduLearnerDTO, EduLearnerInputDTO, EduUpdateLearnerInputDTO } from '../dto/edu-learner.dto';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeEnrollmentService } from '../services/edubridge-enrollment.service';
import { EdubridgeLearnerService } from '../services/edubridge-learner.service';

const coop = () => platformSettings().coopname;

/** Стол пайщика-родителя: обучающиеся, подписки, получение доступа. */
@Resolver()
@Injectable()
export class EdubridgeMemberResolver {
  constructor(
    private readonly learners: EdubridgeLearnerService,
    private readonly enrollments: EdubridgeEnrollmentService
  ) {}

  @Query(() => [EduLearnerDTO], { name: 'edubridgeMyLearners', description: 'Мои обучающиеся' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduLearner', 'read:own')
  async edubridgeMyLearners(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduLearnerDTO[]> {
    const rows = await this.learners.listMine(coop(), m.username as string);
    return rows.map((l) => new EduLearnerDTO(l, { showContact: true }));
  }

  @Mutation(() => EduLearnerDTO, { name: 'edubridgeAddLearner', description: 'Добавить обучающегося — себя или ребёнка' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduLearner', 'manage:own')
  async edubridgeAddLearner(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduLearnerInputDTO): Promise<EduLearnerDTO> {
    return new EduLearnerDTO(await this.learners.add(coop(), m.username as string, data), { showContact: true });
  }

  @Mutation(() => EduLearnerDTO, { name: 'edubridgeUpdateLearner', description: 'Исправить имя или контакт обучающегося (без повторной оплаты)' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduLearner', 'manage:own')
  async edubridgeUpdateLearner(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduUpdateLearnerInputDTO): Promise<EduLearnerDTO> {
    return new EduLearnerDTO(await this.learners.update(coop(), m.username as string, data), { showContact: true });
  }

  @Mutation(() => Boolean, { name: 'edubridgeRemoveLearner', description: 'Удалить обучающегося без действующих подписок' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduLearner', 'manage:own')
  edubridgeRemoveLearner(@CurrentEduMember() m: IEdubridgeMembership, @Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.learners.remove(coop(), m.username as string, id);
  }

  @Query(() => [EduEnrollmentDTO], { name: 'edubridgeMyEnrollments', description: 'Подписки моих обучающихся: курс, доступ, срок' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEnrollment', 'read:own')
  async edubridgeMyEnrollments(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduEnrollmentDTO[]> {
    const rows = await this.enrollments.listMine(coop(), m.username as string);
    return rows.map(({ enrollment, course }) => new EduEnrollmentDTO(enrollment, course));
  }

  @Query(() => EduQuoteDTO, { name: 'edubridgeQuote', description: 'Сумма взноса за период и хватает ли паевого' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEnrollment', 'create:own')
  edubridgeQuote(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduQuoteInputDTO): Promise<EduQuoteDTO> {
    return this.enrollments.quote(coop(), m.username as string, data.learner_id, data.course_id, data.period);
  }

  @Mutation(() => GeneratedDocumentDTO, { name: 'edubridgeConvertStatement', description: 'Сформировать заявление о конвертации паевого взноса в членский' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEnrollment', 'create:own')
  async edubridgeConvertStatement(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduQuoteInputDTO): Promise<GeneratedDocumentDTO> {
    return new GeneratedDocumentDTO(await this.enrollments.statement(coop(), m.username as string, data.learner_id, data.course_id, data.period));
  }

  @Mutation(() => EduEnrollmentDTO, { name: 'edubridgeSubscribe', description: 'Получить доступ: конвертировать паевой в членский и открыть/продлить подписку' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEnrollment', 'create:own')
  async edubridgeSubscribe(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduSubscribeInputDTO): Promise<EduEnrollmentDTO> {
    const saved = await this.enrollments.subscribe(coop(), m.username as string, data.learner_id, data.course_id, data.period, data.document);
    return new EduEnrollmentDTO(saved, await this.enrollments.courseOf(saved));
  }
}
