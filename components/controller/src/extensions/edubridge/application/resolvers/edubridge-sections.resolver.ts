import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, OptionalGqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import {
  EduArchiveInputDTO,
  EduLevelDTO,
  EduReorderInputDTO,
  EduSaveLevelInputDTO,
  EduSaveSectionInputDTO,
  EduSectionDTO,
  EduSectionsFilterInputDTO,
} from '../dto/edu-section.dto';
import { EdubridgeSectionsService, type SectionWithLevels } from '../services/edubridge-sections.service';

const coop = () => platformSettings().coopname;
const toDTO = ({ section, levels }: SectionWithLevels) => new EduSectionDTO(section, levels);

/**
 * Справочник разделов и уровней каталога. Читать может каждый, как каталог;
 * править — тот, кто правит курсы.
 */
@Resolver()
@Injectable()
export class EdubridgeSectionsResolver {
  constructor(private readonly sections: EdubridgeSectionsService) {}

  @Query(() => [EduSectionDTO], { name: 'edubridgeSections', description: 'Разделы каталога с уровнями в порядке справочника' })
  @UseGuards(OptionalGqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCatalog', 'read')
  async edubridgeSections(@Args('filter', { nullable: true }) filter?: EduSectionsFilterInputDTO): Promise<EduSectionDTO[]> {
    return (await this.sections.list(coop(), filter ?? {})).map(toDTO);
  }

  @Mutation(() => EduSectionDTO, { name: 'edubridgeSaveSection', description: 'Добавить раздел либо переименовать' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeSaveSection(@Args('data') data: EduSaveSectionInputDTO): Promise<EduSectionDTO> {
    return toDTO(await this.sections.saveSection(coop(), data));
  }

  @Mutation(() => EduLevelDTO, { name: 'edubridgeSaveLevel', description: 'Добавить уровень в раздел либо переименовать' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeSaveLevel(@Args('data') data: EduSaveLevelInputDTO): Promise<EduLevelDTO> {
    return new EduLevelDTO(await this.sections.saveLevel(coop(), data));
  }

  @Mutation(() => [EduSectionDTO], { name: 'edubridgeReorderSections', description: 'Порядок разделов' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeReorderSections(@Args('data') data: EduReorderInputDTO): Promise<EduSectionDTO[]> {
    return (await this.sections.reorder(coop(), { ids: data.ids })).map(toDTO);
  }

  @Mutation(() => [EduSectionDTO], { name: 'edubridgeReorderLevels', description: 'Порядок уровней раздела — их последовательность' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeReorderLevels(@Args('data') data: EduReorderInputDTO): Promise<EduSectionDTO[]> {
    return (await this.sections.reorder(coop(), data)).map(toDTO);
  }

  @Mutation(() => EduSectionDTO, { name: 'edubridgeArchiveSection', description: 'Убрать раздел в архив либо вернуть' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeArchiveSection(@Args('data') data: EduArchiveInputDTO): Promise<EduSectionDTO> {
    return toDTO(await this.sections.archiveSection(coop(), data.id, data.archived));
  }

  @Mutation(() => EduLevelDTO, { name: 'edubridgeArchiveLevel', description: 'Убрать уровень в архив либо вернуть' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  async edubridgeArchiveLevel(@Args('data') data: EduArchiveInputDTO): Promise<EduLevelDTO> {
    return new EduLevelDTO(await this.sections.archiveLevel(coop(), data.id, data.archived));
  }
}
