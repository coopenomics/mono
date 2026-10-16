import {
  InnerOrganizationType,
  type InnerEntrepreneurLookupRecord,
  type InnerOrganizationLookupRecord,
} from '@coopenomics/innercoop';

/**
 * Перевод карточки организации DaData (`findById/party`) в поля анкеты
 * вступления. Поле, которое DaData не прислала, остаётся пустым: анкета
 * оставит его пайщику.
 */

/** Часть ответа DaData, которую читает анкета. */
export interface DadataParty {
  inn?: string | null;
  ogrn?: string | null;
  kpp?: string | null;
  name?: { full_with_opf?: string | null; short_with_opf?: string | null } | null;
  opf?: { code?: string | null } | null;
  management?: { name?: string | null; post?: string | null } | null;
  /** ФИО предпринимателя: у ИП приходит вместо руководителя. */
  fio?: { surname?: string | null; name?: string | null; patronymic?: string | null } | null;
  address?: {
    value?: string | null;
    unrestricted_value?: string | null;
    data?: { city?: string | null; settlement?: string | null; region?: string | null } | null;
  } | null;
}

/**
 * Тип организации по коду ОКОПФ. Анкета предлагает три типа, поэтому
 * распознаются только они; прочие формы пайщик выбирает сам.
 */
export function organizationTypeByOkopf(code?: string | null): InnerOrganizationType | undefined {
  if (!code) return undefined;
  // 201xx — потребительские кооперативы всех видов.
  if (code.startsWith('201')) return InnerOrganizationType.COOP;
  // 14xxx — производственные кооперативы (артели), включая сельскохозяйственные.
  if (code.startsWith('14')) return InnerOrganizationType.PRODCOOP;
  if (code === '12300') return InnerOrganizationType.OOO;
  return undefined;
}

/** «ПРЕДСЕДАТЕЛЬ СОВЕТА» → «Председатель совета»: реестр пишет должность прописными. */
export function sentenceCase(text?: string | null): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** «Муравьев Алексей Николаевич» → фамилия, имя, отчество; хвост из нескольких слов — в отчество. */
export function splitFullName(fullName?: string | null): {
  last_name?: string;
  first_name?: string;
  middle_name?: string;
} {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  const [last_name, first_name, ...rest] = parts;
  return { last_name, first_name, middle_name: rest.length ? rest.join(' ') : undefined };
}

function present(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function partyToOrganization(party: DadataParty, inn: string): InnerOrganizationLookupRecord {
  const management = party.management;
  const represented_by = management?.name || management?.post
    ? { ...splitFullName(management?.name), position: sentenceCase(management?.post) }
    : undefined;
  const addressData = party.address?.data;

  return {
    short_name: present(party.name?.short_with_opf),
    full_name: present(party.name?.full_with_opf),
    type: organizationTypeByOkopf(party.opf?.code),
    represented_by,
    city: present(addressData?.city) ?? present(addressData?.settlement) ?? present(addressData?.region),
    full_address: present(party.address?.unrestricted_value) ?? present(party.address?.value),
    details: {
      inn: present(party.inn) ?? inn,
      ogrn: present(party.ogrn),
      kpp: present(party.kpp),
    },
  };
}

/**
 * Карточка ИП в поля анкеты ИП. Адрес не переносится: реестр ИП публикует
 * только индекс и город, а анкете нужен полный адрес — неполный пайщик принял
 * бы за готовый. Город берётся, только если он назван городом или населённым
 * пунктом, регион городом не считается.
 */
export function partyToEntrepreneur(party: DadataParty, inn: string): InnerEntrepreneurLookupRecord {
  const addressData = party.address?.data;
  return {
    last_name: present(party.fio?.surname),
    first_name: present(party.fio?.name),
    middle_name: present(party.fio?.patronymic),
    city: present(addressData?.city) ?? present(addressData?.settlement),
    details: {
      inn: present(party.inn) ?? inn,
      ogrn: present(party.ogrn),
    },
  };
}
