// domain/system/system-domain.module.ts
import { Module } from '@nestjs/common';
import { VARS_REPOSITORY } from '../common/repositories/vars.repository';
import { VarsRepositoryImplementation } from '~/infrastructure/database/generator-repositories/repositories/vars-generator.repository';
import { ORGANIZATION_REPOSITORY } from '../common/repositories/organization.repository';
import { OrganizationRepositoryImplementation } from '~/infrastructure/database/generator-repositories/repositories/organization-generator.repository';
import { MONO_STATUS_REPOSITORY } from '../common/repositories/mono-status.repository';
import { SystemStatusKyselyRepository } from '~/infrastructure/database/kysely/repositories/system-status.kysely-repository';

@Module({
  providers: [
    { provide: VARS_REPOSITORY, useClass: VarsRepositoryImplementation },
    { provide: ORGANIZATION_REPOSITORY, useClass: OrganizationRepositoryImplementation },
    { provide: MONO_STATUS_REPOSITORY, useClass: SystemStatusKyselyRepository },
  ],
  exports: [VARS_REPOSITORY, ORGANIZATION_REPOSITORY, MONO_STATUS_REPOSITORY],
})
export class SystemDomainModule {}
