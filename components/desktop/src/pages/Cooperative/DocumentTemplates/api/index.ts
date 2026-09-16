import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  IDocumentTemplate,
  IDocumentTemplateBlank,
  IDocumentTemplateBlankInput,
  IProposeDocumentApprovalInput,
} from '../model';

/** Реестр шаблонов документов кооператива со состояниями утверждения. */
async function loadDocumentTemplates(coopname: string): Promise<IDocumentTemplate[]> {
  if (!coopname) return [];
  const { [Queries.DocumentApprovals.DocumentTemplates.name]: rows } = await client.Query(
    Queries.DocumentApprovals.DocumentTemplates.query,
    { variables: { coopname } },
  );
  return rows;
}

/** Сколько документов ждут решения совета — для счётчика на вкладке. */
async function loadDocumentTemplatesAttention(coopname: string): Promise<number> {
  if (!coopname) return 0;
  const { [Queries.DocumentApprovals.DocumentTemplatesAttention.name]: count } = await client.Query(
    Queries.DocumentApprovals.DocumentTemplatesAttention.query,
    { variables: { coopname } },
  );
  return Number(count ?? 0);
}

/** Бланк документа: утверждённая или текущая редакция без данных субъекта. */
async function loadDocumentTemplateBlank(data: IDocumentTemplateBlankInput): Promise<IDocumentTemplateBlank> {
  const { [Queries.DocumentApprovals.DocumentTemplateBlank.name]: blank } = await client.Query(
    Queries.DocumentApprovals.DocumentTemplateBlank.query,
    { variables: data },
  );
  return blank;
}

/** Вынести документ или пакет на утверждение совета. */
async function proposeDocumentApproval(data: IProposeDocumentApprovalInput): Promise<IDocumentTemplate[]> {
  const { [Mutations.DocumentApprovals.ProposeDocumentApproval.name]: rows } = await client.Mutation(
    Mutations.DocumentApprovals.ProposeDocumentApproval.mutation,
    { variables: { data } },
  );
  return rows;
}

export const api = {
  loadDocumentTemplates,
  loadDocumentTemplatesAttention,
  loadDocumentTemplateBlank,
  proposeDocumentApproval,
};
