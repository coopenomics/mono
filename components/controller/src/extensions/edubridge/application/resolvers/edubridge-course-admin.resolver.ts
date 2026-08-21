import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, PaginationInputDTO, platformSettings, type PaginationResult } from '@coopenomics/extension-kit';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import {
  EduCourseDTO,
  EduCourseInputDTO,
  EduCoursesFilterInputDTO,
  EduSetCourseStatusInputDTO,
  EduUpdateCourseInputDTO,
  PaginatedEduCoursesDTO,
} from '../dto/edu-course.dto';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import { EdubridgeCourseService } from '../services/edubridge-course.service';

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

  @Mutation(() => EduCourseDTO, { name: 'edubridgeCreateCourse', description: 'Добавить курс (черновик)' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeCreateCourse(@Args('data') data: EduCourseInputDTO): Promise<EduCourseDTO> {
    return new EduCourseDTO(await this.courses.create(platformSettings().coopname, data));
  }

  @Mutation(() => EduCourseDTO, { name: 'edubridgeUpdateCourse', description: 'Изменить курс' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeUpdateCourse(@Args('data') data: EduUpdateCourseInputDTO): Promise<EduCourseDTO> {
    return new EduCourseDTO(await this.courses.update(platformSettings().coopname, data));
  }

  @Mutation(() => EduCourseDTO, { name: 'edubridgeSetCourseStatus', description: 'Опубликовать, снять с публикации или архивировать курс' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeSetCourseStatus(@Args('data') data: EduSetCourseStatusInputDTO): Promise<EduCourseDTO> {
    return new EduCourseDTO(await this.courses.setStatus(platformSettings().coopname, data.id, data.status));
  }
}
