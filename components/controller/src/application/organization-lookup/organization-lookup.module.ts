import { Module } from '@nestjs/common';
import { OrganizationLookupResolver } from './resolvers/organization-lookup.resolver';

/**
 * Заполнение анкеты организации по ИНН. Реестр поставщиков глобальный
 * (`OrganizationLookupRegistryModule`): в него пишут расширения через порт,
 * читает этот резолвер.
 */
@Module({
  providers: [OrganizationLookupResolver],
})
export class OrganizationLookupModule {}
