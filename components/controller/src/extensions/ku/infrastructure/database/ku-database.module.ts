import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityVersionTypeormEntity } from '@coopenomics/extension-kit/sync';
import { KuDecisionTypeormEntity } from '../entities/ku-decision.typeorm-entity';
import { KuDecisionQuestionTypeormEntity } from '../entities/ku-decision-question.typeorm-entity';
import { KuTrustRequestTypeormEntity } from '../entities/ku-trust-request.typeorm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KuDecisionTypeormEntity,
      KuDecisionQuestionTypeormEntity,
      KuTrustRequestTypeormEntity,
      EntityVersionTypeormEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class KuDatabaseModule {}
