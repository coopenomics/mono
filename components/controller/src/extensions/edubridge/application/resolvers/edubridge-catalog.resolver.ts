import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  OptionalGqlJwtAuthGuard,
  PaginationInputDTO,
  platformSettings,
  type PaginationResult,
  RequireRight,
  RightsGuard,
} from '@coopenomics/extension-kit';
import {
  EduCatalogCourseDTO,
  EduCatalogFilterInputDTO,
  PaginatedEduCatalogCoursesDTO,
} from '../dto/edu-course.dto';
import { EdubridgeCourseService } from '../services/edubridge-course.service';

/** Каталог курсов — открыт посетителю до вступления. */
@Resolver()
@Injectable()
export class EdubridgeCatalogResolver {
  constructor(private readonly courses: EdubridgeCourseService) {}

  @Query(() => PaginatedEduCatalogCoursesDTO, { name: 'edubridgeCatalog', description: 'Каталог опубликованных курсов' })
  @UseGuards(OptionalGqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCatalog', 'read')
  async edubridgeCatalog(
    @Args('filter', { nullable: true }) filter?: EduCatalogFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<EduCatalogCourseDTO>> {
    const page = await this.courses.catalog(platformSettings().coopname, filter ?? {}, options);
    return { ...page, items: page.items.map((c) => new EduCatalogCourseDTO(c)) };
  }

  @Query(() => EduCatalogCourseDTO, { name: 'edubridgeCatalogCourse', description: 'Карточка курса' })
  @UseGuards(OptionalGqlJwtAuthGuard, RightsGuard)
  @RequireRight('EduCatalog', 'read')
  async edubridgeCatalogCourse(@Args('id', { type: () => ID }) id: string): Promise<EduCatalogCourseDTO> {
    return new EduCatalogCourseDTO(await this.courses.catalogCourse(platformSettings().coopname, id));
  }
}
