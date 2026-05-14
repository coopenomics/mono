import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CppRegistryDomainService } from '~/domain/cpp-registry/services/cpp-registry-domain.service';
import { CppRegistryEntryDTO } from '../dto/cpp-registry-entry.dto';

@Resolver(() => CppRegistryEntryDTO)
export class CppRegistryResolver {
  constructor(private readonly service: CppRegistryDomainService) {}

  @Query(() => [CppRegistryEntryDTO], {
    name: 'cppRegistry',
    description:
      'Реестр ЦПП-шаблонов кооператива — связки template_document_registry_id ↔ расширение (Story 1.2).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async cppRegistry(): Promise<CppRegistryEntryDTO[]> {
    const entries = await this.service.findAll();
    return entries.map(CppRegistryEntryDTO.fromDomain);
  }
}
