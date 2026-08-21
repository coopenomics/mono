import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { OptionalGqlJwtAuthGuard, PaginationInputDTO, platformSettings, type PaginationResult } from '@coopenomics/extension-kit';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import {
  EduCatalogCourseDTO,
  EduCatalogFilterInputDTO,
  EduCatalogSubjectDTO,
  PaginatedEduCatalogCoursesDTO,
} from '../dto/edu-course.dto';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import { EdubridgeCourseService } from '../services/edubridge-course.service';

/** Каталог курсов — открыт посетителю до вступления. */
@Resolver()
@Injectable()
export class EdubridgeCatalogResolver {
  constructor(private readonly courses: EdubridgeCourseService) {}

  @Query(() => PaginatedEduCatalogCoursesDTO, { name: 'edubridgeCatalog', description: 'Каталог опубликованных курсов' })
  @UseGuards(OptionalGqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCatalog', 'read')
  async edubridgeCatalog(
    @Args('filter', { nullable: true }) filter?: EduCatalogFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<EduCatalogCourseDTO>> {
    const page = await this.courses.catalog(platformSettings().coopname, filter ?? {}, options);
    return { ...page, items: page.items.map((c) => new EduCatalogCourseDTO(c)) };
  }

  @Query(() => EduCatalogCourseDTO, { name: 'edubridgeCatalogCourse', description: 'Карточка курса' })
  @UseGuards(OptionalGqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCatalog', 'read')
  async edubridgeCatalogCourse(@Args('id', { type: () => ID }) id: string): Promise<EduCatalogCourseDTO> {
    return new EduCatalogCourseDTO(await this.courses.catalogCourse(platformSettings().coopname, id));
  }

  @Query(() => [EduCatalogSubjectDTO], { name: 'edubridgeCatalogSubjects', description: 'Предметы и классы каталога' })
  @UseGuards(OptionalGqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCatalog', 'read')
  edubridgeCatalogSubjects(): Promise<EduCatalogSubjectDTO[]> {
    return this.courses.subjects(platformSettings().coopname);
  }
}
