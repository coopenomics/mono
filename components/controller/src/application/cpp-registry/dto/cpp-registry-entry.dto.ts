import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { CppRegistryEntryDomainEntity } from '~/domain/cpp-registry/entities/cpp-registry-entry.entity';

@ObjectType('CppRegistryEntry', {
  description: 'Запись реестра ЦПП-шаблонов кооператива (Story 1.2 / Locked Decision L8).',
})
export class CppRegistryEntryDTO {
  @Field(() => Int, {
    description:
      'document_registry_id template-документа в платформенном document registry (наполняется Story 1.7).',
  })
  template_document_registry_id!: number;

  @Field(() => String, {
    description: 'Имя расширения, которому принадлежит шаблон (например, "market").',
  })
  required_for_extension!: string;

  @Field(() => Boolean, {
    description:
      'true → fallback FR43a (захардкоженная пара template-документов, MVP без UI конструктора ЦПП).',
  })
  mvp_hardcoded!: boolean;

  static fromDomain(entry: CppRegistryEntryDomainEntity): CppRegistryEntryDTO {
    const dto = new CppRegistryEntryDTO();
    dto.template_document_registry_id = entry.template_document_registry_id;
    dto.required_for_extension = entry.required_for_extension;
    dto.mvp_hardcoded = entry.mvp_hardcoded;
    return dto;
  }
}
