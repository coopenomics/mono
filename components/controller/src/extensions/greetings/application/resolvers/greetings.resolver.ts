import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentUser,
  GqlJwtAuthGuard,
  PaginationInputDTO,
  PaginationResult,
  RequireRight,
  RightsGuard,
  createPaginationResult,
} from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { GreetingTemplateStatus } from '../../domain/greetings.enums';
import {
  GreetingCalendarEntryDTO,
  GreetingMailingOccurrenceDTO,
  GreetingPreviewDTO,
  GreetingPreviewInputDTO,
  GreetingSendDTO,
  GreetingTemplateDTO,
  GreetingTemplateInputDTO,
  GreetingVariableDTO,
} from '../dto/greetings.dto';
import { GreetingsTemplatesService } from '../services/greetings-templates.service';
import { GreetingsLetterService } from '../services/greetings-letter.service';
import { GreetingsQueryService } from '../services/greetings-query.service';

const paginatedGreetingSends = createPaginationResult(GreetingSendDTO, 'PaginatedGreetingSends');

/**
 * API приложения «Поздравления». Читает совет, шаблоны пишет и включает
 * председатель.
 */
@Resolver()
export class GreetingsResolver {
  constructor(
    private readonly templates: GreetingsTemplatesService,
    private readonly letters: GreetingsLetterService,
    private readonly query: GreetingsQueryService
  ) {}

  @Query(() => [GreetingTemplateDTO], { name: 'greetingsTemplates', description: 'Шаблоны поздравлений, новые периоды первыми' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'read')
  async templatesList(): Promise<GreetingTemplateDTO[]> {
    return this.templates.list();
  }

  @Query(() => GreetingTemplateDTO, { name: 'greetingsTemplate', description: 'Шаблон поздравления' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'read')
  async template(@Args('id') id: string): Promise<GreetingTemplateDTO> {
    return this.templates.get(id);
  }

  @Query(() => [GreetingVariableDTO], { name: 'greetingsVariables', description: 'Переменные, которые можно вставить в шаблон' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'read')
  variables(): GreetingVariableDTO[] {
    return this.query.variables();
  }

  @Query(() => GreetingPreviewDTO, {
    name: 'greetingsPreview',
    description: 'Письмо по несохранённому тексту на выбранном пайщике либо на ближайшем имениннике',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'read')
  async preview(@Args('data') data: GreetingPreviewInputDTO): Promise<GreetingPreviewDTO> {
    return this.letters.preview({ subject: data.subject, body: data.body }, data.username, data.kind);
  }

  @Query(() => [GreetingCalendarEntryDTO], { name: 'greetingsCalendar', description: 'Дни рождения пайщиков месяца' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'read')
  async calendar(
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number
  ): Promise<GreetingCalendarEntryDTO[]> {
    return this.query.month(year, month);
  }

  @Query(() => [GreetingMailingOccurrenceDTO], { name: 'greetingsMailings', description: 'Рассылки месяца с итогом отправки' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'read')
  async mailings(
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number
  ): Promise<GreetingMailingOccurrenceDTO[]> {
    return this.query.mailings(year, month);
  }

  @Query(() => [GreetingCalendarEntryDTO], { name: 'greetingsUpcoming', description: 'Ближайшие дни рождения пайщиков' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'read')
  async upcoming(@Args('limit', { type: () => Int, defaultValue: 10 }) limit: number): Promise<GreetingCalendarEntryDTO[]> {
    return this.query.upcoming(limit);
  }

  @Query(() => paginatedGreetingSends, { name: 'greetingsJournal', description: 'Журнал поздравлений, свежие записи первыми' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'read')
  async journal(@Args('options', { nullable: true }) options?: PaginationInputDTO): Promise<PaginationResult<GreetingSendDTO>> {
    return this.query.journal(options);
  }

  @Mutation(() => GreetingTemplateDTO, {
    name: 'greetingsSaveTemplate',
    description: 'Сохранить шаблон поздравления: без идентификатора создаётся черновик',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'manage')
  async saveTemplate(
    @Args('data') data: GreetingTemplateInputDTO,
    @CurrentUser() user: IMonoAccount
  ): Promise<GreetingTemplateDTO> {
    return this.templates.save(data, user.username);
  }

  @Mutation(() => GreetingTemplateDTO, {
    name: 'greetingsSetTemplateStatus',
    description: 'Включить шаблон в рассылку либо вернуть в черновики',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'manage')
  async setTemplateStatus(
    @Args('id') id: string,
    @Args('status', { type: () => GreetingTemplateStatus }) status: GreetingTemplateStatus
  ): Promise<GreetingTemplateDTO> {
    return this.templates.setStatus(id, status);
  }

  @Mutation(() => Boolean, {
    name: 'greetingsSendTest',
    description: 'Отправить председателю пробное письмо: текст для выбранного пайщика либо ближайшего именинника',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'manage')
  async sendTest(@Args('data') data: GreetingPreviewInputDTO, @CurrentUser() user: IMonoAccount): Promise<boolean> {
    return this.letters.sendTest({ subject: data.subject, body: data.body }, data.username, user.username, data.kind);
  }

  @Mutation(() => Boolean, { name: 'greetingsDeleteTemplate', description: 'Удалить шаблон поздравления' })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Greetings', 'manage')
  async deleteTemplate(@Args('id') id: string): Promise<boolean> {
    return this.templates.remove(id);
  }
}
