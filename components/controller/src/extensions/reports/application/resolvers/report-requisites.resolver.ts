import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { config } from '~/config';
import {
  ReportRequisitesViewDTO,
  UpdateReportRequisitesInputDTO,
  ReportReadinessViewDTO,
  RequisiteSource,
} from '../dto/requisites.dto';
import { ReportType } from '../../domain/enums/report-type.enum';
import {
  ReportRequisitesService,
  type MergedRequisites,
  type RequisiteField,
} from '../../domain/services/report-requisites.service';

@Resolver()
export class ReportRequisitesResolver {
  constructor(private readonly service: ReportRequisitesService) {}

  @Query(() => ReportRequisitesViewDTO, {
    name: 'getReportRequisites',
    description: 'Объединённый вид реквизитов кооператива (ончейн + ручные) с источником каждого поля',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getReportRequisites(): Promise<ReportRequisitesViewDTO> {
    const merged = await this.service.getMerged(config.coopname);
    return toView(merged);
  }

  @Mutation(() => ReportRequisitesViewDTO, {
    name: 'updateReportRequisites',
    description: 'Обновить ручные реквизиты кооператива. ИНН/КПП/ОГРН игнорируются — это ончейн',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async updateReportRequisites(
    @Args('input', { type: () => UpdateReportRequisitesInputDTO }) input: UpdateReportRequisitesInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
  ): Promise<ReportRequisitesViewDTO> {
    const merged = await this.service.upsert({
      coopname: config.coopname,
      updated_by: currentUser?.username ?? 'system',
      okved: input.okved ?? undefined,
      okfs: input.okfs ?? undefined,
      okopf: input.okopf ?? undefined,
      oktmo: input.oktmo ?? undefined,
      okpo: input.okpo ?? undefined,
      sfr_reg_number: input.sfrRegNumber ?? undefined,
      chairman_position: input.chairmanPosition ?? undefined,
      signer_snils: input.signerSnils ?? undefined,
      signer_rep_doc: input.signerRepDoc ?? undefined,
      signer_type: input.signerType ?? undefined,
      phone_override: input.phoneOverride ?? undefined,
      address_override: input.addressOverride ?? undefined,
    });
    return toView(merged);
  }

  @Query(() => ReportReadinessViewDTO, {
    name: 'checkReportReadiness',
    description: 'Проверить готовность реквизитов для генерации конкретной формы',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async checkReportReadiness(
    @Args('reportType', { type: () => ReportType }) reportType: ReportType,
  ): Promise<ReportReadinessViewDTO> {
    const r = await this.service.checkReadiness(config.coopname, reportType);
    return {
      reportType,
      ready: r.ready,
      missingFields: r.missingFields.map((m) => ({
        key: m.key,
        label: m.label,
        reason: m.reason,
        source: m.source as RequisiteSource,
      })),
    };
  }
}

function f(rf: RequisiteField): { value: string | null; source: RequisiteSource } {
  return { value: rf.value, source: rf.source as RequisiteSource };
}

function toView(m: MergedRequisites): ReportRequisitesViewDTO {
  return {
    coopname: m.coopname,
    inn: f(m.inn),
    kpp: f(m.kpp),
    ogrn: f(m.ogrn),
    orgName: f(m.orgName),
    address: f(m.address),
    phone: f(m.phone),
    signerLastName: f(m.signerLastName),
    signerFirstName: f(m.signerFirstName),
    signerMiddleName: f(m.signerMiddleName),
    chairmanPositionFromOrg: f(m.chairmanPositionFromOrg),
    okved: f(m.okved),
    okfs: f(m.okfs),
    okopf: f(m.okopf),
    oktmo: f(m.oktmo),
    okpo: f(m.okpo),
    sfrRegNumber: f(m.sfrRegNumber),
    chairmanPosition: f(m.chairmanPosition),
    signerSnils: f(m.signerSnils),
    signerRepDoc: f(m.signerRepDoc),
    signerType: m.signerType,
  };
}
