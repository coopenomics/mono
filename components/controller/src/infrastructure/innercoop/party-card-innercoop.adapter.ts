import { Inject, Injectable } from '@nestjs/common';
import type { IIndividualPort, IOrganizationPort, InnerIndividual, InnerOrganization } from '@coopenomics/innercoop';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '~/domain/common/repositories/organization.repository';
import { INDIVIDUAL_REPOSITORY, type IndividualRepository } from '~/domain/common/repositories/individual.repository';

/** Реализация `IOrganizationPort` поверх карточек организаций ядра. */
@Injectable()
export class OrganizationInnercoopAdapter implements IOrganizationPort {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository
  ) {}

  async findByUsername(username: string): Promise<InnerOrganization> {
    return this.organizationRepository.findByUsername(username);
  }

  async create(organization: InnerOrganization): Promise<void> {
    return this.organizationRepository.create(organization);
  }
}

/** Реализация `IIndividualPort` поверх карточек физических лиц ядра. */
@Injectable()
export class IndividualInnercoopAdapter implements IIndividualPort {
  constructor(
    @Inject(INDIVIDUAL_REPOSITORY)
    private readonly individualRepository: IndividualRepository
  ) {}

  async findByUsername(username: string): Promise<InnerIndividual> {
    return this.individualRepository.findByUsername(username);
  }

  async create(individual: InnerIndividual): Promise<void> {
    return this.individualRepository.create(individual);
  }
}
