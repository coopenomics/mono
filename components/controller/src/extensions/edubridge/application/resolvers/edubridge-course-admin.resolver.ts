import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, PaginationInputDTO, platformSettings, type PaginationResult } from '@coopenomics/extension-kit';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import {
  EduCourseDTO,
  EduCourseInputDTO,
  EduCoursesFilterInputDTO,
  EduPlatformCourseDTO,
  EduSetCourseStatusInputDTO,
  EduTeacherOptionDTO,
  EduUpdateCourseInputDTO,
  PaginatedEduCoursesDTO,
} from '../dto/edu-course.dto';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeCourseService } from '../services/edubridge-course.service';
import { EduAccessCarrier } from '../../domain/enums';

/** Управление курсами — владелец и администратор. */
@Resolver()
@Injectable()
export class EdubridgeCourseAdminResolver {
  constructor(private readonly courses: EdubridgeCourseService) {}

  @Query(() => PaginatedEduCoursesDTO, { name: 'edubridgeCourses', description: 'Курсы кооператива во всех состояниях' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeCourses(
    @Args('filter', { nullable: true }) filter?: EduCoursesFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<EduCourseDTO>> {
    const page = await this.courses.list(platformSettings().coopname, filter ?? {}, options);
    return { ...page, items: page.items.map((c) => new EduCourseDTO(c)) };
  }

  @Query(() => EduCourseDTO, { name: 'edubridgeCourse', description: 'Курс со служебными полями' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeCourse(@Args('id', { type: () => ID }) id: string): Promise<EduCourseDTO> {
    return new EduCourseDTO(await this.courses.get(platformSettings().coopname, id));
  }

  @Query(() => [EduTeacherOptionDTO], { name: 'edubridgeTeacherOptions', description: 'Преподаватели, которых можно назначить на курс' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  edubridgeTeacherOptions(): Promise<EduTeacherOptionDTO[]> {
    return this.courses.teacherOptions(platformSettings().coopname);
  }

  @Query(() => [EduPlatformCourseDTO], { name: 'edubridgePlatformCourses', description: 'Курсы и группы на площадке кооператива — для привязки курса каталога' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  edubridgePlatformCourses(@Args('carrier', { type: () => EduAccessCarrier }) carrier: EduAccessCarrier): Promise<EduPlatformCourseDTO[]> {
    return this.courses.platformCourses(carrier);
  }

  @Mutation(() => EduCourseDTO, { name: 'edubridgeCreateCourse', description: 'Добавить курс (черновик)' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeCreateCourse(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduCourseInputDTO): Promise<EduCourseDTO> {
    return new EduCourseDTO(await this.courses.create(platformSettings().coopname, m.username as string, data));
  }

  @Mutation(() => EduCourseDTO, { name: 'edubridgeUpdateCourse', description: 'Изменить курс' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeUpdateCourse(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduUpdateCourseInputDTO): Promise<EduCourseDTO> {
    return new EduCourseDTO(await this.courses.update(platformSettings().coopname, m.username as string, data));
  }

  @Mutation(() => EduCourseDTO, { name: 'edubridgeSetCourseStatus', description: 'Опубликовать, снять с публикации или архивировать курс' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeSetCourseStatus(@Args('data') data: EduSetCourseStatusInputDTO): Promise<EduCourseDTO> {
    return new EduCourseDTO(await this.courses.setStatus(platformSettings().coopname, data.id, data.status));
  }
}
