// infrastructure/repositories/organization.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Cooperative } from 'cooptypes';
import httpStatus from 'http-status';
import { IndividualDomainEntity } from '~/domain/branch/entities/individual-domain.entity';
import type { IndividualDomainInterface } from '~/domain/common/interfaces/individual-domain.interface';
import type { IndividualRepository } from '~/domain/common/repositories/individual.repository';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import { HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class IndividualRepositoryImplementation implements IndividualRepository {
  constructor(@Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort) {}

  async findByUsername(username: string): Promise<IndividualDomainEntity> {
    // Используем генератор для извлечения данных из базы
    const individual = (await this.generatorPort.get('individual', { username })) as Cooperative.Users.IIndividualData;
    if (!individual) throw new HttpApiError(httpStatus.BAD_REQUEST, `Пользователь ${username} не найден`);
    else return new IndividualDomainEntity(individual);
  }

  async create(data: IndividualDomainInterface): Promise<void> {
    await this.generatorPort.save('individual', data);
  }
}
