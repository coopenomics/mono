// infrastructure/repositories/organization.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import type { EntrepreneurDomainInterface } from '~/domain/common/interfaces/entrepreneur-domain.interface';
import type { EntrepreneurRepository } from '~/domain/common/repositories/entrepreneur.repository';
import httpStatus from 'http-status';
import { EntrepreneurDomainEntity } from '~/domain/branch/entities/entrepreneur-domain.entity';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import type { Cooperative } from 'cooptypes';
import { HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class EntrepreneurRepositoryImplementation implements EntrepreneurRepository {
  constructor(@Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort) {}

  async findByUsername(username: string): Promise<EntrepreneurDomainEntity> {
    // Используем генератор для извлечения данных из базы
    const entrepreneur = (await this.generatorPort.get('entrepreneur', { username })) as Cooperative.Users.IEntrepreneurData;
    if (!entrepreneur) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, `Предприниматель ${username} не найден`);
    }
    return new EntrepreneurDomainEntity(entrepreneur);
  }

  async create(data: EntrepreneurDomainInterface): Promise<void> {
    await this.generatorPort.save('entrepreneur', data);
  }
}
