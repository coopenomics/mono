import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

/** Загрузить фотографию пайщика; в ответ — ссылка на неё. */
export async function uploadAvatar(data: Mutations.Accounts.UploadAvatar.IInput['data']): Promise<string> {
  const { [Mutations.Accounts.UploadAvatar.name]: result } = await client.Mutation(Mutations.Accounts.UploadAvatar.mutation, {
    variables: { data },
  });
  return result;
}

/** Снять фотографию — в удостоверении снова будут инициалы. */
export async function removeAvatar(): Promise<boolean> {
  const { [Mutations.Accounts.RemoveAvatar.name]: result } = await client.Mutation(Mutations.Accounts.RemoveAvatar.mutation);
  return result;
}
