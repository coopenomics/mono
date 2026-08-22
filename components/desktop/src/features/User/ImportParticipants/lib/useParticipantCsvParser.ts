import { Zeus } from '@coopenomics/sdk';
import moment from 'src/shared/lib/utils/dates/moment';
import { ref } from 'vue';
import { convertToEOSDate } from 'src/shared/lib/utils/formatDateForEos';
import type {
  ContributionDefaults,
  ParticipantCsvRow,
  ParticipantType,
  OrganizationCsvRow,
  EntrepreneurCsvRow,
  IndividualCsvRow,
} from '../model/types';

interface ParserOptions {
  coopSymbol: () => string;
  getDefaults: (type: ParticipantType) => ContributionDefaults;
  quantity: () => { precision: number; symbol: string };
}

type HeaderMap = Record<string, string>;

const COMMON_HEADERS: HeaderMap = {
  '№': 'row',
  'почта': 'email',
  'телефон': 'phone',
  'вступительный взнос': 'initial',
  'минимальный взнос': 'minimum',
  'дата вступления': 'created_at',
  'реферер': 'referer',
};

const INDIVIDUAL_HEADERS: HeaderMap = {
  ...COMMON_HEADERS,
  'фамилия': 'last_name',
  'имя': 'first_name',
  'отчество': 'middle_name',
  'дата рождения': 'birthdate',
  'адрес': 'full_address',
  'паспорт серия': 'passport_series',
  'паспорт номер': 'passport_number',
  'кем выдан': 'passport_issued_by',
  'когда выдан': 'passport_issued_at',
  'код подразделения': 'passport_code',
};

const ENTREPRENEUR_HEADERS: HeaderMap = {
  ...COMMON_HEADERS,
  'фамилия': 'last_name',
  'имя': 'first_name',
  'отчество': 'middle_name',
  'дата рождения': 'birthdate',
  'страна': 'country',
  'город': 'city',
  'адрес': 'full_address',
  'инн': 'inn',
  'огрн': 'ogrn',
  'банк': 'bank_name',
  'расчетный счет': 'account_number',
  'бик': 'bik',
  'корр счет': 'corr',
  'валюта': 'currency',
};

const ORGANIZATION_HEADERS: HeaderMap = {
  ...COMMON_HEADERS,
  'краткое название': 'short_name',
  'полное название': 'full_name',
  'тип': 'org_type',
  'страна': 'country',
  'город': 'city',
  'юрадрес': 'full_address',
  'фактический адрес': 'fact_address',
  'телефон': 'phone',
  'инн': 'inn',
  'огрн': 'ogrn',
  'кпп': 'kpp',
  'представитель фамилия': 'rep_last_name',
  'представитель имя': 'rep_first_name',
  'представитель отчество': 'rep_middle_name',
  'должность представителя': 'rep_position',
  'основание полномочий': 'rep_based_on',
  'банк': 'bank_name',
  'расчетный счет': 'account_number',
  'бик': 'bik',
  'корр счет': 'corr',
  'валюта': 'currency',
};

const pickDelimiter = (line: string) => {
  const comma = line.split(',').length;
  const semicolon = line.split(';').length;
  return semicolon > comma ? ';' : ',';
};

const splitCsvLine = (line: string, delimiter: string) => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
};

const toEosDate = (value?: string) => {
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'DD.MM.YYYY',
    'DD/MM/YYYY',
    'YYYY-MM-DDTHH:mm:ss',
    moment.ISO_8601,
  ];

  const parsed = value
    ? moment(value, formats, true)
    : moment();

  if (!parsed.isValid()) {
    return convertToEOSDate(moment().format('YYYY/MM/DD HH:mm'));
  }

  return convertToEOSDate(parsed.format('YYYY/MM/DD HH:mm'));
};

const normalizeCountry = (value?: string): Zeus.Country => {
  const candidate = (value || '').trim();
  const entries = Object.values(Zeus.Country) as string[];
  return entries.includes(candidate) ? (candidate as Zeus.Country) : Zeus.Country.Russia;
};

const normalizeOrgType = (value?: string): Zeus.OrganizationType => {
  const candidate = (value || '').trim();
  const entries = Object.values(Zeus.OrganizationType) as string[];
  return entries.includes(candidate)
    ? (candidate as Zeus.OrganizationType)
    : Zeus.OrganizationType.COOP;
};

const typeLabelShort = (type: ParticipantType) => {
  switch (type) {
    case 'individual':
      return 'Физлицо';
    case 'entrepreneur':
      return 'ИП';
    case 'organization':
      return 'Юрлицо';
    default:
      return type;
  }
};

const typeLabelFull = (type: ParticipantType) => {
  switch (type) {
    case 'individual':
      return 'Физические лица';
    case 'entrepreneur':
      return 'Индивидуальные предприниматели';
    case 'organization':
      return 'Юридические лица';
    default:
      return '';
  }
};

const validatePastDate = (value?: string) => {
  if (!value) return { error: 'Не указана дата вступления' };
  const parsed = moment(value);
  if (!parsed.isValid()) return { error: 'Некорректная дата вступления' };
  if (parsed.isAfter(moment())) {
    return { error: 'Дата вступления должна быть в прошлом' };
  }
  return { value: convertToEOSDate(parsed.format('YYYY/MM/DD HH:mm')) };
};

const normalizeDate = (value?: string) => {
  if (!value) return '';
  const formats = ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD.MM.YYYY', 'DD/MM/YYYY', moment.ISO_8601];
  const parsed = moment(value, formats, true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : value;
};

const formatQuantity = (
  value: string | undefined,
  fallback: string,
  quantityMeta: () => { precision: number; symbol: string },
) => {
  const meta = quantityMeta();
  const num = Number(toNumericString(value, fallback));
  const safeFallback = Number(toNumericString(fallback, '0'));
  const finalNum = Number.isFinite(num) ? num : safeFallback;
  return `${finalNum.toFixed(meta.precision)} ${meta.symbol}`;
};

const buildPassport = (row: Record<string, string>): Zeus.ModelTypes['PassportInput'] | undefined => {
  const passport = {
    series: row.passport_series,
    number: row.passport_number,
    issued_by: row.passport_issued_by,
    issued_at: row.passport_issued_at,
    code: row.passport_code,
  };

  const required = ['series', 'number', 'issued_by', 'issued_at', 'code'] as const;
  const hasAll = required.every((key) => (passport as any)[key]);

  if (!hasAll) return undefined;

  return {
    series: Number(passport.series),
    number: Number(passport.number),
    issued_by: passport.issued_by || '',
    issued_at: passport.issued_at || '',
    code: passport.code || '',
  };
};

const requiredError = (missing: string[]) =>
  missing.length ? `Отсутствуют обязательные поля: ${missing.join(', ')}` : '';

const normalizeHeaders = (header: string) =>
  header.replace(/"/g, '').trim().toLowerCase();

const toNumericString = (value?: string, fallback = '0') => {
  if (!value) return fallback;
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? String(num) : fallback;
};

export function useParticipantCsvParser(options: ParserOptions) {
  const rows = ref<ParticipantCsvRow[]>([]);
  const fileName = ref<string>('');
  const isParsing = ref(false);

  const clear = () => {
    rows.value = [];
    fileName.value = '';
  };

  const parseCsv = async (file: File, type: ParticipantType) => {
    isParsing.value = true;
    fileName.value = file.name;

    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) ?? '');
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsText(file, 'utf-8');
    });

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new Error('Файл пуст');
    }

    const delimiter = pickDelimiter(lines[0]);
    const headers = splitCsvLine(lines[0], delimiter).map((h) =>
      normalizeHeaders(h),
    );

    const map =
      type === 'individual'
        ? INDIVIDUAL_HEADERS
        : type === 'entrepreneur'
          ? ENTREPRENEUR_HEADERS
          : ORGANIZATION_HEADERS;

    const requiredHeaders =
      type === 'individual'
        ? [
            'почта',
            'фамилия',
            'имя',
            'телефон',
            'дата рождения',
            'адрес',
            'дата вступления',
          ]
        : type === 'entrepreneur'
          ? [
              'почта',
              'фамилия',
              'имя',
              'телефон',
              'дата рождения',
              'страна',
              'город',
              'адрес',
              'инн',
              'огрн',
              'банк',
              'расчетный счет',
              'бик',
              'корр счет',
              'дата вступления',
            ]
          : [
              'почта',
              'краткое название',
              'полное название',
              'телефон',
              'страна',
              'город',
              'юрадрес',
              'фактический адрес',
              'представитель фамилия',
              'представитель имя',
              'должность представителя',
              'основание полномочий',
              'инн',
              'огрн',
              'кпп',
              'банк',
              'расчетный счет',
              'бик',
              'корр счет',
              'дата вступления',
            ];

    const mappedHeaders = headers.map((header) => map[header]);
    const missingHeaders = requiredHeaders.filter(
      (required) => !headers.includes(required),
    );

    if (missingHeaders.length) {
      throw new Error(
        `Отсутствуют столбцы: ${missingHeaders.join(', ')}`,
      );
    }

    const defaults = options.getDefaults(type);
    const parsed: ParticipantCsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitCsvLine(lines[i], delimiter).map((v) =>
        v.replace(/"/g, '').trim(),
      );
      if (!values.length || values.every((v) => !v)) continue;

      const row: Record<string, string> = {};
      mappedHeaders.forEach((target, idx) => {
        if (!target) return;
        row[target] = values[idx] ?? '';
      });

      const createdAtCheck = validatePastDate(row.created_at);
      const base = {
        rowNumber: parsed.length + 1,
        type,
        email: row.email || '',
        phone: row.phone,
        created_at: createdAtCheck.value,
        initial: toNumericString(row.initial, defaults.initial),
        minimum: toNumericString(row.minimum, defaults.minimum),
        spread_initial: false,
        referer: row.referer,
        displayName: '',
        status: createdAtCheck.error ? ('error' as const) : ('pending' as const),
        error: createdAtCheck.error || '',
      };

      if (type === 'individual') {
        const individual: IndividualCsvRow = {
          ...base,
          type: 'individual',
          displayType: typeLabelShort('individual'),
          displayTypeFull: typeLabelFull('individual'),
          first_name: row.first_name ?? '',
          last_name: row.last_name ?? '',
          middle_name: row.middle_name,
          birthdate: normalizeDate(row.birthdate),
          full_address: row.full_address ?? '',
          passport: buildPassport(row),
        };

        individual.displayName = [individual.last_name, individual.first_name, individual.middle_name]
          .filter(Boolean)
          .join(' ')
          .trim();

        const missing = ['email', 'first_name', 'last_name', 'birthdate', 'full_address', 'created_at'].filter(
          (field) => !(individual as any)[field],
        );

        individual.input =
          individual.status === 'error'
            ? undefined
            : {
                email: individual.email,
                created_at: individual.created_at ?? toEosDate(),
                initial: formatQuantity(individual.initial, defaults.initial, options.quantity),
                minimum: formatQuantity(individual.minimum, defaults.minimum, options.quantity),
                spread_initial: individual.spread_initial ?? false,
                referer: individual.referer,
                type: Zeus.AccountType.individual,
                individual_data: {
                  first_name: individual.first_name,
                  last_name: individual.last_name,
                  middle_name: individual.middle_name ?? '',
                  birthdate: individual.birthdate,
                  full_address: individual.full_address,
                  phone: individual.phone ?? '',
                  passport: individual.passport ?? null,
                },
              };

        individual.error = requiredError(missing);
        individual.status = individual.error ? 'error' : 'pending';
        parsed.push(individual);
      } else if (type === 'entrepreneur') {
        const entrepreneur: EntrepreneurCsvRow = {
          ...base,
          type: 'entrepreneur',
          displayType: typeLabelShort('entrepreneur'),
          displayTypeFull: typeLabelFull('entrepreneur'),
          first_name: row.first_name ?? '',
          last_name: row.last_name ?? '',
          middle_name: row.middle_name,
          birthdate: normalizeDate(row.birthdate),
          country: normalizeCountry(row.country),
          city: row.city ?? '',
          full_address: row.full_address ?? '',
          details: {
            inn: row.inn ?? '',
            ogrn: row.ogrn ?? '',
          },
          bank_account: {
            bank_name: row.bank_name ?? '',
            account_number: row.account_number ?? '',
            currency: row.currency || 'RUB',
            details: {
              bik: row.bik ?? '',
              corr: row.corr ?? '',
            },
          },
        };

        entrepreneur.displayName = [entrepreneur.last_name, entrepreneur.first_name, entrepreneur.middle_name]
          .filter(Boolean)
          .join(' ')
          .trim();

        const missing = [
          'email',
          'first_name',
          'last_name',
          'birthdate',
          'country',
          'city',
          'full_address',
          'details.inn',
          'details.ogrn',
          'bank_account.bank_name',
          'bank_account.account_number',
          'bank_account.details.bik',
          'bank_account.details.corr',
          'created_at',
        ].filter((field) => {
          const path = field.split('.');
          let current: any = entrepreneur as any;
          for (const key of path) {
            current = current?.[key];
          }
          return !current;
        });

        entrepreneur.input =
          entrepreneur.status === 'error'
            ? undefined
            : {
                email: entrepreneur.email,
                created_at: entrepreneur.created_at ?? toEosDate(),
                initial: formatQuantity(entrepreneur.initial, defaults.initial, options.quantity),
                minimum: formatQuantity(entrepreneur.minimum, defaults.minimum, options.quantity),
                spread_initial: entrepreneur.spread_initial ?? false,
                referer: entrepreneur.referer,
                type: Zeus.AccountType.entrepreneur,
                entrepreneur_data: {
                  first_name: entrepreneur.first_name,
                  last_name: entrepreneur.last_name,
                  middle_name: entrepreneur.middle_name ?? '',
                  birthdate: entrepreneur.birthdate,
                  phone: entrepreneur.phone ?? '',
                  country: normalizeCountry(entrepreneur.country as string),
                  city: entrepreneur.city,
                  full_address: entrepreneur.full_address,
                  details: entrepreneur.details,
                  bank_account: entrepreneur.bank_account,
                },
              };

        entrepreneur.error = requiredError(missing);
        entrepreneur.status = entrepreneur.error ? 'error' : 'pending';
        parsed.push(entrepreneur);
      } else {
        const organization: OrganizationCsvRow = {
          ...base,
          type: 'organization',
          displayType: typeLabelShort('organization'),
          displayTypeFull: typeLabelFull('organization'),
          short_name: row.short_name ?? '',
          full_name: row.full_name ?? '',
          org_type: normalizeOrgType(row.org_type),
          country: normalizeCountry(row.country),
          city: row.city ?? '',
          full_address: row.full_address ?? '',
          fact_address: row.fact_address ?? '',
          phone: row.phone ?? '',
          represented_by: {
            first_name: row.rep_first_name ?? '',
            last_name: row.rep_last_name ?? '',
            middle_name: row.rep_middle_name ?? '',
            position: row.rep_position ?? '',
            based_on: row.rep_based_on ?? '',
          },
          details: {
            inn: row.inn ?? '',
            ogrn: row.ogrn ?? '',
            kpp: row.kpp ?? '',
          },
          bank_account: {
            bank_name: row.bank_name ?? '',
            account_number: row.account_number ?? '',
            currency: row.currency || 'RUB',
            details: {
              bik: row.bik ?? '',
              corr: row.corr ?? '',
            },
          },
        };

        organization.displayName = organization.short_name || organization.full_name;

        const missing = [
          'email',
          'short_name',
          'full_name',
          'org_type',
          'country',
          'city',
          'full_address',
          'fact_address',
          'phone',
          'represented_by.first_name',
          'represented_by.last_name',
          'represented_by.position',
          'represented_by.based_on',
          'details.inn',
          'details.ogrn',
          'details.kpp',
          'bank_account.bank_name',
          'bank_account.account_number',
          'bank_account.details.bik',
          'bank_account.details.corr',
          'created_at',
        ].filter((field) => {
          const path = field.split('.');
          let current: any = organization as any;
          for (const key of path) {
            current = current?.[key];
          }
          return !current;
        });

        organization.input =
          organization.status === 'error'
            ? undefined
            : {
                email: organization.email,
                created_at: organization.created_at ?? toEosDate(),
                initial: formatQuantity(organization.initial, defaults.initial, options.quantity),
                minimum: formatQuantity(organization.minimum, defaults.minimum, options.quantity),
                spread_initial: organization.spread_initial ?? false,
                referer: organization.referer,
                type: Zeus.AccountType.organization,
                organization_data: {
                  short_name: organization.short_name,
                  full_name: organization.full_name,
                  type: organization.org_type as Zeus.OrganizationType,
                  country: organization.country as Zeus.Country,
                  city: organization.city,
                  full_address: organization.full_address,
                  fact_address: organization.fact_address,
                  phone: organization.phone,
                  represented_by: {
                    ...organization.represented_by,
                    middle_name: organization.represented_by.middle_name || '',
                  },
                  details: organization.details,
                  bank_account: organization.bank_account,
                },
              };

        organization.error = requiredError(missing);
        organization.status = organization.error ? 'error' : 'pending';
        parsed.push(organization);
      }
    }

    rows.value = parsed;
    isParsing.value = false;
    return parsed;
  };

  return {
    rows,
    fileName,
    isParsing,
    parseCsv,
    clear,
  };
}
