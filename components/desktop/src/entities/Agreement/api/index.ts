/**
 * Чтение соглашений кооператива и шаблонов документов через GraphQL
 * контроллера. Прямой `fetchTable` к чейну убран — ADR: фронт не ходит в
 * блокчейн напрямую, всё через controller.
 */
import type { DraftContract, SovietContract } from 'cooptypes';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { ILoadPaginatedAgreementsInput, IPaginatedAgreementsResponse } from '../model/types';

async function loadCooperativeAgreements(coopname: string): Promise<SovietContract.Tables.CoopAgreements.ICoopAgreement[]> {
  // Гард: если system_info ещё не загрузился, coopname будет undefined/''.
  // Zeus сериализует variables в {} и сервер падает на required $coopname.
  if (!coopname) return [];
  const { [Queries.Agreements.CooperativeAgreements.name]: rows } = await client.Query(
    Queries.Agreements.CooperativeAgreements.query,
    { variables: { coopname } }
  );
  return (rows ?? []).map((r) => ({
    type: r.type,
    coopname: r.coopname,
    program_id: r.program_id,
    draft_id: r.draft_id,
  })) as unknown as SovietContract.Tables.CoopAgreements.ICoopAgreement[];
}

async function loadAgreementTemplates(coopname: string): Promise<DraftContract.Tables.Drafts.IDraft[]> {
  if (!coopname) return [];
  const { [Queries.Agreements.AgreementTemplates.name]: rows } = await client.Query(
    Queries.Agreements.AgreementTemplates.query,
    { variables: { coopname } }
  );
  return (rows ?? []) as unknown as DraftContract.Tables.Drafts.IDraft[];
}

async function loadPaginatedAgreements(data: ILoadPaginatedAgreementsInput): Promise<IPaginatedAgreementsResponse> {
  const { [Queries.Agreements.Agreements.name]: output } = await client.Query(
    Queries.Agreements.Agreements.query,
    {
      variables: {
        data,
      },
    },
  );
  return output;
}

export const api = { loadCooperativeAgreements, loadAgreementTemplates, loadPaginatedAgreements };
