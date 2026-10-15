import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, OptionalGqlJwtAuthGuard, platformSettings, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import { EduLessonStatus } from '../../domain/enums';
import { EduGroupDTO } from '../dto/edu-group.dto';
import { EduLessonDTO } from '../dto/edu-teacher.dto';
import { EduLessonCalendarFilterDTO, EduMoveLessonInputDTO, EduPlanLessonInputDTO, EduSetGroupScheduleInputDTO } from '../dto/edu-schedule.dto';
import { EdubridgeCalendarService } from '../services/edubridge-calendar.service';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { EdubridgeGroupService } from '../services/edubridge-group.service';
import { EduEnrollmentStatus } from '../../domain/enums';
import { isResumable } from '../../domain/lib/resumable';

const coop = (): string => platformSettings().coopname;

/**
 * Календарь занятий: администратор задаёт окна расписания группы, добавляет,
 * переносит и отменяет занятия и видит календарь школы; участник видит
 * занятия своей группы.
 */
@Resolver()
@Injectable()
export class EdubridgeCalendarResolver {
  constructor(
    private readonly calendar: EdubridgeCalendarService,
    private readonly teachers: EdubridgeTeacherService,
    private readonly groups: EdubridgeGroupService,
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly lessons: EdubridgeLessonKyselyRepository
  ) {}

  private async groupDto(groupId: string): Promise<EduGroupDTO> {
    const group = await this.groups.get(coop(), groupId);
    const subscriptions = await this.enrollments.findByGroup(coop(), group.id);
    return new EduGroupDTO(group, {
      learners_active: subscriptions.filter((e) => e.status === EduEnrollmentStatus.ACTIVE || isResumable(e)).length,
      lessons_held: (await this.lessons.findByGroup(coop(), group.id)).filter((l) => l.status === EduLessonStatus.HELD).length,
    });
  }

  @Query(() => [EduLessonDTO], { name: 'edubridgeLessonCalendar', description: 'Календарь занятий школы: по курсу, группе, преподавателю и окну дат' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCourse', 'read')
  async edubridgeLessonCalendar(@Args('filter', { nullable: true }) filter?: EduLessonCalendarFilterDTO): Promise<EduLessonDTO[]> {
    return this.teachers.lessonDtos(coop(), await this.calendar.calendar(coop(), filter ?? {}));
  }

  @Query(() => [EduLessonDTO], { name: 'edubridgeGroupLessons', description: 'Занятия группы для участника: что было и что будет' })
  @UseGuards(OptionalGqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCatalog', 'read')
  async edubridgeGroupLessons(@Args('group_id', { type: () => ID }) groupId: string): Promise<EduLessonDTO[]> {
    // Отменённые занятия остаются в календаре участника: он видит, что занятие в этот день снято.
    return this.teachers.lessonDtos(coop(), await this.calendar.ofGroup(coop(), groupId));
  }

  @Mutation(() => EduGroupDTO, { name: 'edubridgeSetGroupSchedule', description: 'Задать окна расписания группы и срок на отчёт: календарь занятий перестраивается' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCourse', 'manage')
  async edubridgeSetGroupSchedule(@Args('data') data: EduSetGroupScheduleInputDTO): Promise<EduGroupDTO> {
    const group = await this.calendar.setSchedule(coop(), data);
    return this.groupDto(group.id);
  }

  @Mutation(() => EduLessonDTO, { name: 'edubridgePlanLesson', description: 'Назначить занятие сверх расписания: дата, длительность, преподаватель' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCourse', 'manage')
  async edubridgePlanLesson(@Args('data') data: EduPlanLessonInputDTO): Promise<EduLessonDTO> {
    const [dto] = await this.teachers.lessonDtos(coop(), [await this.calendar.plan(coop(), data)]);
    return dto;
  }

  @Mutation(() => EduLessonDTO, { name: 'edubridgeMoveLesson', description: 'Перенести запланированное занятие: дата, длительность, преподаватель, тема' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCourse', 'manage')
  async edubridgeMoveLesson(@Args('data') data: EduMoveLessonInputDTO): Promise<EduLessonDTO> {
    const [dto] = await this.teachers.lessonDtos(coop(), [await this.calendar.move(coop(), data)]);
    return dto;
  }

  @Mutation(() => EduLessonDTO, { name: 'edubridgeCancelLesson', description: 'Отменить запланированное занятие: номер и место в программе свободны' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCourse', 'manage')
  async edubridgeCancelLesson(@Args('lesson_id', { type: () => ID }) lessonId: string): Promise<EduLessonDTO> {
    const [dto] = await this.teachers.lessonDtos(coop(), [await this.calendar.cancel(coop(), lessonId)]);
    return dto;
  }
}
