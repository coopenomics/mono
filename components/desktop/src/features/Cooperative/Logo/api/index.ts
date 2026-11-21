/**
 * Логотип кооператива хранится ядром в настройках узла — отдельно от фотографий
 * пайщиков. Председатель меняет его в профиле кооператива на столе администратора;
 * Стол заказов читает ту же ссылку через порт и показывает её в шапке профиля.
 */
import { Mutations } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { fileToBase64 } from 'src/shared/lib/utils';

export async function uploadCooperativeLogo(file: File): Promise<string> {
  const { [Mutations.Marketplace.UploadCooperativeLogo.name]: url } = await client.Mutation(
    Mutations.Marketplace.UploadCooperativeLogo.mutation,
    {
      variables: {
        data: { content_base64: await fileToBase64(file), mime_type: file.type },
      },
    },
  );
  return url;
}

export async function removeCooperativeLogo(): Promise<void> {
  await client.Mutation(Mutations.Marketplace.RemoveCooperativeLogo.mutation);
}
