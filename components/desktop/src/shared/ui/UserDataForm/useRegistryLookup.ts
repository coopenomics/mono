import { ref, shallowRef, computed, watch, onMounted } from 'vue';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { t } from 'src/shared/i18n';

export type IRegistryLookupInput = Queries.Registration.LookupOrganization.IInput['data'];
export type IOrganizationLookupResult = NonNullable<
  Queries.Registration.LookupOrganization.IOutput['lookupOrganization']
>;
export type IEntrepreneurLookupResult = NonNullable<
  Queries.Registration.LookupEntrepreneur.IOutput['lookupEntrepreneur']
>;

/** Сведения организации по ИНН; сбой сервера — «сведений нет». */
export async function lookupOrganization(data: IRegistryLookupInput): Promise<IOrganizationLookupResult | null> {
  try {
    const { [Queries.Registration.LookupOrganization.name]: result } = await client.Query(
      Queries.Registration.LookupOrganization.query,
      { variables: { data } },
    );
    return result ?? null;
  } catch (error) {
    console.error('Сведения об организации по ИНН не получены', error);
    return null;
  }
}

/** Сведения ИП по ИНН; сбой сервера — «сведений нет». */
export async function lookupEntrepreneur(data: IRegistryLookupInput): Promise<IEntrepreneurLookupResult | null> {
  try {
    const { [Queries.Registration.LookupEntrepreneur.name]: result } = await client.Query(
      Queries.Registration.LookupEntrepreneur.query,
      { variables: { data } },
    );
    return result ?? null;
  } catch (error) {
    console.error('Сведения ИП по ИНН не получены', error);
    return null;
  }
}

async function loadLookupCountries(): Promise<string[]> {
  try {
    const { [Queries.Registration.GetOrganizationLookupCountries.name]: result } = await client.Query(
      Queries.Registration.GetOrganizationLookupCountries.query,
    );
    return result;
  } catch (error) {
    console.error('Не удалось узнать страны с заполнением анкеты по ИНН', error);
    return [];
  }
}

export interface IRegistryLookupOptions<TResult, TField extends string> {
  /** Страна анкеты. */
  country: () => string | undefined;
  /** ИНН в анкете. */
  inn: () => string | undefined;
  /** Поиск в реестре страны. */
  find: (data: IRegistryLookupInput) => Promise<TResult | null>;
  /** Заполнить анкету найденным и назвать заполненные поля — они закроются для правки. */
  apply: (found: TResult) => TField[];
  /** Очистить заполненные поля, когда пайщик берёт другой ИНН. */
  clear: (fields: TField[]) => void;
  /** Раскрытие анкеты: до ввода ИНН шаг прячет то, что идёт после анкеты. */
  onDetailsShown: (shown: boolean) => void;
}

/**
 * Анкета по ИНН. Если для страны анкеты есть коннектор реестра, пайщик сперва
 * вводит ИНН; найденные сведения ложатся в поля и закрываются для правки, а
 * прочие поля появляются после поиска. Нет коннектора или сведений — анкета
 * заполняется вручную.
 */
export function useRegistryLookup<TResult, TField extends string>(options: IRegistryLookupOptions<TResult, TField>) {
  const countries = ref<string[]>([]);
  const countriesLoaded = ref(false);
  const loading = ref(false);
  // manual — анкета вернулась с введённым ИНН: поиска в этот раз не было.
  const lookupState = ref<'idle' | 'found' | 'notFound' | 'manual'>('idle');
  // shallowRef: глубокий ref разворачивает обобщённый TField в UnwrapRefSimple, и
  // сравнения с полями формы перестают сходиться по типам. Массив и так
  // заменяется целиком.
  const lockedFields = shallowRef<(TField | 'inn')[]>([]);

  const lookupAvailable = computed(() => countries.value.includes(options.country() ?? ''));

  // До ответа о странах видно только поле ИНН: иначе ручная анкета мелькнула бы
  // и спряталась.
  const showRest = computed(
    () => countriesLoaded.value && (!lookupAvailable.value || lookupState.value !== 'idle'),
  );
  watch(showRest, (shown) => options.onDetailsShown(shown), { immediate: true });

  const innHint = computed(() =>
    lookupAvailable.value && lookupState.value === 'notFound'
      ? t('ui.registryLookup.notFound')
      : undefined,
  );

  const isLocked = (field: TField | 'inn') => lockedFields.value.includes(field);

  const runLookup = async (inn: string) => {
    loading.value = true;
    const found = await options.find({ country: options.country() ?? '', inn });
    loading.value = false;
    // Пока шёл запрос, ИНН могли поменять — ответ уже не про этого пайщика.
    if (options.inn() !== inn) return;
    if (found) {
      lockedFields.value = ['inn', ...options.apply(found)];
      lookupState.value = 'found';
    } else {
      lookupState.value = 'notFound';
    }
  };

  /** «Другой ИНН»: снять сведения прежнего поиска и вернуться к вводу ИНН. */
  const resetLookup = () => {
    options.clear(lockedFields.value.filter((field): field is TField => field !== 'inn'));
    lockedFields.value = [];
    lookupState.value = 'idle';
  };

  watch(options.inn, (inn) => {
    if (!lookupAvailable.value || lookupState.value === 'found' || !inn) return;
    if (inn.length === 10 || inn.length === 12) runLookup(inn);
  });

  onMounted(async () => {
    countries.value = await loadLookupCountries();
    if (options.inn()) lookupState.value = 'manual';
    countriesLoaded.value = true;
  });

  return { loading, lookupState, showRest, innHint, isLocked, resetLookup };
}
