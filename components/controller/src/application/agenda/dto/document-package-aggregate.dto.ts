import { ObjectType, Field } from '@nestjs/graphql';
import { StatementDetailAggregateDTO } from './statement-detail-aggregate.dto';
import { DecisionDetailAggregateDTO } from './decision-detail-aggregate.dto';
import { ActDetailAggregateDTO } from './act-detail-aggregate.dto';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

@ObjectType('DocumentPackageAggregate', {
  description:
    'Комплексный объект папки цифрового документа с агрегатами, который включает в себя заявление, решение, акты и связанные документы',
})
export class DocumentPackageAggregateDTO implements DocumentPackageAggregateDomainInterface {
  @Field(() => StatementDetailAggregateDTO, {
    description: 'Объект цифрового документа заявления с агрегатом',
    nullable: true,
  })
  statement!: StatementDetailAggregateDTO | null;

  @Field(() => DecisionDetailAggregateDTO, {
    description: 'Объект цифрового документа решения с агрегатом',
    nullable: true,
  })
  decision!: DecisionDetailAggregateDTO | null;

  @Field(() => [ActDetailAggregateDTO], {
    description: 'Массив объект(ов) актов с агрегатами, относящихся к заявлению',
  })
  acts!: ActDetailAggregateDTO[];

  @Field(() => [DocumentAggregateDTO], {
    description: 'Массив связанных документов с агрегатами, извлечённых из мета-данных',
  })
  links!: DocumentAggregateDTO[];

  constructor(data?: DocumentPackageAggregateDomainInterface) {
    if (data) {
      // Маппинг Statement
      this.statement = data.statement ? new StatementDetailAggregateDTO(data.statement) : null;

      // Маппинг Decision
      this.decision = data.decision ? new DecisionDetailAggregateDTO(data.decision) : null;

      // Маппинг Acts
      this.acts = data.acts.map((act) => new ActDetailAggregateDTO(act));

      // Маппинг Links
      this.links = data.links.map((link) => new DocumentAggregateDTO(link));
    } else {
      this.statement = null;
      this.decision = null;
      this.acts = [];
      this.links = [];
    }
  }
}
