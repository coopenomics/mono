import { ref } from 'vue';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type IOrganizationLookupInput = Queries.Registration.LookupOrganization.IInput['data'];
export type IOrganizationLookupResult = NonNullable<
  Queries.Registration.LookupOrganization.IOutput['lookupOrganization']
>;

/**
 * Сведения об организации по ИНН из реестра страны анкеты.
 *
 * Страны с коннектором сервер называет сам: для остальных анкета заполняется
 * вручную. Сбой сервиса сервер отдаёт пустым ответом, поэтому здесь ошибка
 * значит только «сведений нет».
 */
export function useOrganizationLookup() {
  const countries = ref<string[]>([]);
  const loading = ref(false);

  const loadCountries = async (): Promise<void> => {
    try {
      const { [Queries.Registration.GetOrganizationLookupCountries.name]: result } = await client.Query(
        Queries.Registration.GetOrganizationLookupCountries.query,
      );
      countries.value = result;
    } catch (error) {
      console.error('Не удалось узнать страны с заполнением анкеты по ИНН', error);
      countries.value = [];
    }
  };

  const lookup = async (data: IOrganizationLookupInput): Promise<IOrganizationLookupResult | null> => {
    loading.value = true;
    try {
      const { [Queries.Registration.LookupOrganization.name]: result } = await client.Query(
        Queries.Registration.LookupOrganization.query,
        { variables: { data } },
      );
      return result ?? null;
    } catch (error) {
      console.error('Сведения об организации по ИНН не получены', error);
      return null;
    } finally {
      loading.value = false;
    }
  };

  return { countries, loading, loadCountries, lookup };
}
