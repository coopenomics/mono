import { client } from 'src/shared/api/client';
import { useSystemStore } from 'src/entities/System/model';
import { Mutations } from '@coopenomics/sdk';

export function useSetCooperativeKey() {
  async function setCooperativeKey(wif: string): Promise<boolean> {
    const system = useSystemStore();
    const data: Partial<Mutations.System.SaveWif.IInput> = {
      username: system.info.coopname,
      wif: wif,
      permission: 'active',
    };

    const { [Mutations.System.SaveWif.name]: result } = await client.Mutation(
      Mutations.System.SaveWif.mutation,
      {
        variables: {
          data,
        },
      },
    );

    // Обновляем информацию о системе после установки ключа
    await useSystemStore().loadSystemInfo();

    return result;
  }

  return { setCooperativeKey };
}
