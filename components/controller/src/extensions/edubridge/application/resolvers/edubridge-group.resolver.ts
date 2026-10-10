import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, OptionalGqlJwtAuthGuard, platformSettings, RequireRight, RightsGuard, SELF } from '@coopenomics/extension-kit';
import { EduCreateGroupInputDTO, EduGroupDTO, EduUpdateGroupInputDTO } from '../dto/edu-group.dto';
import { EduEnrollmentStatus, EduGroupStatus } from '../../domain/enums';
import type { EdubridgeGroupRecord } from '../../infrastructure/entities';
import { EdubridgeEnrollmentKyselyRepository } from '../../infrastructure/repositories/edubridge-enrollment.kysely-repository';
import { EdubridgeLessonKyselyRepository } from '../../infrastructure/repositories/edubridge-lesson.kysely-repository';
import { EdubridgeGroupService } from '../services/edubridge-group.service';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EduAssignmentStatus } from '../../domain/enums';

const coop = (): string => platformSettings().coopname;

/** Группы (наборы) курса: администратор открывает и ведёт их, участник видит группы с открытым набором. */
@Resolver()
@Injectable()
export class EdubridgeGroupResolver {
  constructor(
    private readonly groups: EdubridgeGroupService,
    private readonly enrollments: EdubridgeEnrollmentKyselyRepository,
    private readonly lessons: EdubridgeLessonKyselyRepository,
    private readonly teachers: EdubridgeTeacherService
  ) {}

  private async dto(group: EdubridgeGroupRecord): Promise<EduGroupDTO> {
    const subscriptions = await this.enrollments.findByGroup(coop(), group.id);
    return new EduGroupDTO(group, {
      learners_active: subscriptions.filter((e) => e.status === EduEnrollmentStatus.ACTIVE).length,
      lessons_held: (await this.lessons.findByGroup(coop(), group.id)).length,
    });
  }

  @Query(() => [EduGroupDTO], { name: 'edubridgeCourseGroups', description: 'Группы курса' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCourse', 'read')
  async edubridgeCourseGroups(@Args('course_id', { type: () => ID }) courseId: string): Promise<EduGroupDTO[]> {
    return Promise.all((await this.groups.list(coop(), courseId)).map((g) => this.dto(g)));
  }

  @Query(() => [EduGroupDTO], { name: 'edubridgeOpenGroups', description: 'Группы курса с открытым набором' })
  @UseGuards(OptionalGqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCatalog', 'read')
  async edubridgeOpenGroups(@Args('course_id', { type: () => ID }) courseId: string): Promise<EduGroupDTO[]> {
    const open = (await this.groups.list(coop(), courseId)).filter((g) => g.status === EduGroupStatus.ACTIVE && g.enrollment_open);
    return Promise.all(open.map((g) => this.dto(g)));
  }

  @Query(() => [EduGroupDTO], { name: 'edubridgeMyTeachingGroups', description: 'Идущие группы курсов, к которым допущен преподаватель' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduAssignment', 'read:own', SELF)
  async edubridgeMyTeachingGroups(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduGroupDTO[]> {
    const assignments = await this.teachers.listAssignments(coop(), m.username as string);
    const courseIds = [...new Set(assignments.filter((a) => a.assignment.status === EduAssignmentStatus.ACTIVE).map((a) => a.assignment.course_id))];
    const groups = (await Promise.all(courseIds.map((id) => this.groups.list(coop(), id)))).flat().filter((g) => g.status === EduGroupStatus.ACTIVE);
    return Promise.all(groups.map((g) => this.dto(g)));
  }

  @Mutation(() => EduGroupDTO, { name: 'edubridgeCreateGroup', description: 'Открыть новую группу курса' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCourse', 'manage')
  async edubridgeCreateGroup(@Args('data') data: EduCreateGroupInputDTO): Promise<EduGroupDTO> {
    return this.dto(await this.groups.create(coop(), data));
  }

  @Mutation(() => EduGroupDTO, { name: 'edubridgeUpdateGroup', description: 'Изменить группу: название, дату начала, набор, привязку к площадке' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCourse', 'manage')
  async edubridgeUpdateGroup(@Args('data') data: EduUpdateGroupInputDTO): Promise<EduGroupDTO> {
    return this.dto(await this.groups.update(coop(), data));
  }
}
