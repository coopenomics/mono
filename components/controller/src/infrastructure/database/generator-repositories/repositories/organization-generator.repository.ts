// infrastructure/repositories/organization.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Cooperative } from 'cooptypes';
import httpStatus from 'http-status';
import { OrganizationDomainEntity } from '~/domain/branch/entities/organization-domain.entity';
import type { OrganizationDomainInterface } from '~/domain/common/interfaces/organization-domain.interface';
import { OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import { HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class OrganizationRepositoryImplementation implements OrganizationRepository {
  constructor(@Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort) {}

  async findByUsername(coopname: string): Promise<OrganizationDomainEntity> {
    // Используем генератор для извлечения данных из базы
    const organization = (await this.generatorPort.get('organization', {
      username: coopname,
    })) as Cooperative.Users.IOrganizationData;
    if (!organization) throw new HttpApiError(httpStatus.BAD_REQUEST, `Организация ${coopname} не найдена`);

    return new OrganizationDomainEntity(organization);
  }

  async create(data: OrganizationDomainInterface): Promise<void> {
    await this.generatorPort.save('organization', data);
  }
}
