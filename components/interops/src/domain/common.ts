/**
 * Общие доменные интерфейсы — пагинация, организации, блокчейн
 */

export interface IPaginationInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface IPaginationResult<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface IOrganizationDomain {
  username: string;
  type: string;
  short_name: string;
  full_name: string;
  represented_by: {
    first_name: string;
    last_name: string;
    middle_name: string;
    position: string;
    based_on: string;
  };
  country: string;
  city: string;
  full_address: string;
  fact_address: string;
  phone: string;
  email: string;
  details: {
    inn: string;
    ogrn: string;
    kpp: string;
  };
}

export interface IBlockchainActionDomain {
  account: string;
  name: string;
  authorization: Array<{ actor: string; permission: string }>;
  data: any;
}

export interface IUdataDocumentParametersPort {
  getDocumentParameters(coopname: string, username: string): Promise<any>;
}

export const UDATA_DOCUMENT_PARAMETERS_PORT = Symbol('UdataDocumentParametersPort');

export interface IUdataRepository {
  findByUsername(coopname: string, username: string): Promise<any | null>;
  save(data: any): Promise<void>;
}

export const UDATA_REPOSITORY = Symbol('UdataRepository');
