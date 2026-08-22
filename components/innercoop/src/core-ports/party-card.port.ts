/**
 * Карточки сторон — реквизиты организации и данные физического лица.
 *
 * Расширения читают их, чтобы подставить в документ или показать кассиру, а
 * `ku` заводит карточку участка, когда совет подтвердил его создание. Раньше
 * инжектились `ORGANIZATION_REPOSITORY` и `INDIVIDUAL_REPOSITORY` по пути
 * `~/domain/common`, которого за пределами монолита нет.
 *
 * Порты **не скоупят доступ**: паспортные данные и реквизиты — чувствительные,
 * право их смотреть проверяет вызывающий до обращения сюда.
 */

/** Кто подписывает от имени организации и на каком основании. */
export interface InnerRepresentative {
  first_name: string;
  last_name: string;
  middle_name: string;
  position: string;
  based_on: string;
}

/** Регистрационные номера организации. */
export interface InnerOrganizationDetails {
  inn: string;
  ogrn: string;
  kpp: string;
}

export interface InnerOrganization {
  username: string;
  /** Организационно-правовая форма. */
  type: string;
  short_name: string;
  full_name: string;
  represented_by: InnerRepresentative;
  country: string;
  city: string;
  /** Юридический адрес. */
  full_address: string;
  /** Фактический адрес. */
  fact_address: string;
  phone: string;
  email: string;
  details: InnerOrganizationDetails;
}

export interface InnerPassport {
  series: number;
  number: number;
  issued_by: string;
  issued_at: string;
  code: string;
}

export interface InnerIndividual {
  username: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  birthdate: string;
  full_address: string;
  phone: string;
  email: string;
  passport?: InnerPassport;
}

export interface IOrganizationPort {
  /** Карточка организации по учётному имени. */
  findByUsername(username: string): Promise<InnerOrganization>;

  create(organization: InnerOrganization): Promise<void>;
}

export interface IIndividualPort {
  /** Карточка физического лица по учётному имени. */
  findByUsername(username: string): Promise<InnerIndividual>;

  create(individual: InnerIndividual): Promise<void>;
}

export const ORGANIZATION_PORT = Symbol.for('Innercoop.CorePort.Organization');
export const INDIVIDUAL_PORT = Symbol.for('Innercoop.CorePort.Individual');
