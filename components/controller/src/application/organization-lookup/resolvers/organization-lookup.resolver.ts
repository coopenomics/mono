import { Args, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { OrganizationLookupRegistry } from '../organization-lookup.registry';
import { LookupOrganizationInputDTO, OrganizationLookupResultDTO } from '../dto/organization-lookup.dto';

/**
 * Сведения об организации по ИНН для анкеты вступления.
 *
 * Анкету заполняет человек без учётной записи, поэтому запросы открыты, а
 * поиск ограничен по частоте: иначе узел стал бы бесплатным посредником к
 * платному сервису кооператива. Ключ сервиса остаётся у расширения на сервере.
 */
@Resolver()
export class OrganizationLookupResolver {
  constructor(private readonly registry: OrganizationLookupRegistry) {}

  @Query(() => [String], {
    name: 'getOrganizationLookupCountries',
    description: 'Страны, для которых анкета организации заполняется сведениями из реестра по ИНН',
  })
  getOrganizationLookupCountries(): string[] {
    return this.registry.countries();
  }

  @Query(() => OrganizationLookupResultDTO, {
    name: 'lookupOrganization',
    nullable: true,
    description: 'Сведения об организации из государственного реестра по ИНН; пусто — сведений нет, анкета заполняется вручную',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async lookupOrganization(
    @Args('data', { type: () => LookupOrganizationInputDTO }) data: LookupOrganizationInputDTO
  ): Promise<OrganizationLookupResultDTO | null> {
    return this.registry.findByInn(data.country, data.inn);
  }
}
