import { GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import type { InnerGeneratedDocument } from '@coopenomics/innercoop';

/** Документ фабрики в ответ GraphQL: к подписи на столе. */
export function toGeneratedDocumentDTO(e: InnerGeneratedDocument): GeneratedDocumentDTO {
  const dto = new GeneratedDocumentDTO();
  dto.full_title = e.full_title;
  dto.html = e.html;
  dto.hash = e.hash;
  dto.meta = e.meta;
  dto.binary = e.binary;
  return dto;
}
