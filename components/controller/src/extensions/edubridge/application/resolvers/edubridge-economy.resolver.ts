import { Injectable, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, PaginationInputDTO, platformSettings, type PaginationResult } from '@coopenomics/extension-kit';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EduCreateExpenseInputDTO, EduExpenseDTO, PaginatedEduExpensesDTO } from '../dto/edu-expense.dto';
import { EdubridgeExpenseService } from '../services/edubridge-expense.service';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import {
  EduCourseEconomyDTO,
  EduCourseEconomyInputDTO,
  EduCourseFeeDTO,
  EduEconomySettingsDTO,
  EduProgramFundDTO,
  EduSetEconomySettingsInputDTO,
  EduSetTeacherRateInputDTO,
} from '../dto/edu-economy.dto';
import { EdubridgeEconomyService } from '../services/edubridge-economy.service';

const coop = () => platformSettings().coopname;

/** Экономика программы: целевой членский взнос кооператива, ставки часа, расчёт взносов. */
@Resolver()
@Injectable()
export class EdubridgeEconomyResolver {
  constructor(
    private readonly economy: EdubridgeEconomyService,
    private readonly expenses: EdubridgeExpenseService
  ) {}

  @Query(() => PaginatedEduExpensesDTO, { name: 'edubridgeExpenses', description: 'Расходы программы: что оплачивается из фонда' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEconomy', 'read')
  edubridgeExpenses(@Args('options', { nullable: true }) options?: PaginationInputDTO): Promise<PaginationResult<EduExpenseDTO>> {
    return this.expenses.list(coop(), options);
  }

  @Mutation(() => String, { name: 'edubridgeCreateExpense', description: 'Подать расход программы: средства фонда выделяются под расход' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEconomy', 'manage')
  edubridgeCreateExpense(@CurrentEduMember() m: IEdubridgeMembership, @Args('data') data: EduCreateExpenseInputDTO): Promise<string> {
    return this.expenses.create(coop(), m.username as string, data);
  }

  @Query(() => EduEconomySettingsDTO, { name: 'edubridgeEconomySettings', description: 'Целевой членский взнос кооператива и предельная скидка за взнос разом за весь курс' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEconomy', 'read')
  edubridgeEconomySettings(): Promise<EduEconomySettingsDTO> {
    return this.economy.settings();
  }

  @Query(() => EduProgramFundDTO, { name: 'edubridgeProgramFund', description: 'Деньги программы: кошельки и движение средств' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduEconomy', 'read')
  edubridgeProgramFund(): Promise<EduProgramFundDTO> {
    return this.economy.fund(coop());
  }

  @Mutation(() => EduEconomySettingsDTO, { name: 'edubridgeSetEconomySettings', description: 'Задать целевой членский взнос кооператива' })
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
