import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

/** Параметры кооператива, которые принимает сервер (VarsInput). */
export type ICooperativeVarsInput = NonNullable<Mutations.System.UpdateSystem.IInput['data']['vars']>;

/** Сохранить параметры кооператива. Сервер кладёт их поверх текущих (поля расширений не теряются). */
async function updateVars(vars: ICooperativeVarsInput): Promise<void> {
  const data: Mutations.System.UpdateSystem.IInput['data'] = { vars };
  await client.Mutation(Mutations.System.UpdateSystem.mutation, { variables: { data } });
}

export const editVarsApi = { updateVars };
