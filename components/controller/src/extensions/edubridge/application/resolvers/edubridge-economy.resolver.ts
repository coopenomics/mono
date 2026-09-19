import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import {
  EduCourseEconomyDTO,
  EduCourseEconomyInputDTO,
  EduCourseFeeDTO,
  EduEconomySettingsDTO,
  EduSetEconomySettingsInputDTO,
  EduSetTeacherRateInputDTO,
} from '../dto/edu-economy.dto';
import { EdubridgeEconomyService } from '../services/edubridge-economy.service';

const coop = () => platformSettings().coopname;

/** Экономика программы: наценка кооператива, ставки часа, расчёт взносов. */
@Resolver()
@Injectable()
export class EdubridgeEconomyResolver {
  constructor(private readonly economy: EdubridgeEconomyService) {}

  @Query(() => EduEconomySettingsDTO, { name: 'edubridgeEconomySettings', description: 'Наценка кооператива и предельная скидка за год' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEconomy', 'read')
  edubridgeEconomySettings(): Promise<EduEconomySettingsDTO> {
    return this.economy.settings();
  }

  @Mutation(() => EduEconomySettingsDTO, { name: 'edubridgeSetEconomySettings', description: 'Задать наценку кооператива' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEconomy', 'manage')
  edubridgeSetEconomySettings(@Args('data') data: EduSetEconomySettingsInputDTO): Promise<EduEconomySettingsDTO> {
    return this.economy.setMarkup(data.markup_percent);
  }

  @Mutation(() => String, { name: 'edubridgeSetTeacherRate', description: 'Задать ставку часа преподавателя' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEconomy', 'manage')
  edubridgeSetTeacherRate(@Args('data') data: EduSetTeacherRateInputDTO): Promise<string> {
    return this.economy.setTeacherRate(coop(), data.username, data.hourly_rate);
  }

  @Query(() => EduCourseFeeDTO, { name: 'edubridgeCourseFeePreview', description: 'Расчёт взноса по параметрам курса — до сохранения' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  edubridgeCourseFeePreview(@Args('data') data: EduCourseEconomyInputDTO): Promise<EduCourseFeeDTO> {
    return this.economy.preview(data);
  }

  @Query(() => EduCourseEconomyDTO, { name: 'edubridgeCourseEconomy', description: 'Экономика курса: план и факт по назначенным преподавателям' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduCourse', 'manage')
  edubridgeCourseEconomy(@Args('course_id', { type: () => ID }) courseId: string): Promise<EduCourseEconomyDTO> {
    return this.economy.courseEconomy(coop(), courseId);
  }
}
