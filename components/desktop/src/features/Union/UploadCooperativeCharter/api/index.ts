import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type IUploadCooperativeCharterInput =
  Mutations.System.UploadCooperativeCharter.IInput['data'];
export type ICooperativeCharter =
  Mutations.System.UploadCooperativeCharter.IOutput[typeof Mutations.System.UploadCooperativeCharter.name];

/** Приложить устав к заявке кооператива на подключение. */
async function uploadCooperativeCharter(
  data: IUploadCooperativeCharterInput,
): Promise<ICooperativeCharter> {
  const { [Mutations.System.UploadCooperativeCharter.name]: result } = await client.Mutation(
    Mutations.System.UploadCooperativeCharter.mutation,
    { variables: { data } },
  );
  return result;
}

/** Последний приложенный устав кооператива (со свежей ссылкой на скачивание). */
async function loadCooperativeCharter(
  coopname: string,
  username: string,
): Promise<ICooperativeCharter | null> {
  const { [Queries.System.GetCooperativeCharter.name]: result } = await client.Query(
    Queries.System.GetCooperativeCharter.query,
    { variables: { coopname, username } },
  );
  return result ?? null;
}

export const api = { uploadCooperativeCharter, loadCooperativeCharter };
