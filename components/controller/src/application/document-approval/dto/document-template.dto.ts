import { Field, Int, ObjectType } from '@nestjs/graphql';
import { DocumentApprovalRequirement, DocumentApprovalState, DocumentKind } from '~/domain/document-approval/enums/document-approval.enums';

/**
 * Строка реестра шаблонов кооператива: какой документ, кто его использует,
 * какая редакция утверждена советом и какая доступна в сети.
 */
@ObjectType('DocumentTemplate')
export class DocumentTemplateDTO {
  @Field(() => Int, { description: 'Номер шаблона в реестре документов' })
  registry_id!: number;

  @Field(() => String, { description: 'Приложение, использующее документ; базовый набор кооператива — core' })
  extension_name!: string;

  @Field(() => DocumentKind, { description: 'Род документа' })
  kind!: DocumentKind;

  @Field(() => DocumentApprovalRequirement, { description: 'Требуется ли утверждение советом' })
  approval!: DocumentApprovalRequirement;

  @Field(() => String, { nullable: true, description: 'Пакет: документы одного пакета утверждаются одним решением' })
  bundle!: string | null;

  @Field(() => String, { description: 'Название документа' })
  title!: string;

  @Field(() => Int, { description: 'Порядок в списке приложения' })
  order!: number;

  @Field(() => Int, { nullable: true, description: 'Редакция шаблона в сети' })
  current_version!: number | null;

  @Field(() => Int, { nullable: true, description: 'Редакция, утверждённая советом кооператива' })
  approved_version!: number | null;

  @Field(() => Int, { nullable: true, description: 'Номер решения совета об утверждении' })
  approved_decision_id!: number | null;

  @Field(() => String, { nullable: true, description: 'Дата решения совета об утверждении' })
  approved_at!: string | null;

  @Field(() => Int, { nullable: true, description: 'Редакция, которую кооператив предъявляет пайщикам' })
  effective_version!: number | null;

  @Field(() => DocumentApprovalState, { description: 'Состояние документа в кооперативе' })
  state!: DocumentApprovalState;

  @Field(() => String, { nullable: true, description: 'Хэш проекта решения в повестке совета, если документ вынесен на утверждение' })
  pending_hash!: string | null;
}
