import type { IndividualDomainInterface } from '~/domain/common/interfaces/individual-domain.interface';
import type { OrganizationDomainInterface } from '~/domain/common/interfaces/organization-domain.interface';

export type BranchDomainInterface = Omit<OrganizationDomainInterface, 'username'> & {
  braname: string; ///< имя аккаунта
  trustee: IndividualDomainInterface;
  trusted: IndividualDomainInterface[];
  participants_count: number; ///< количество пайщиков, состоящих в участке
  is_private: boolean; ///< приватный участок: выбрать его можно только из белого списка
  is_available: boolean; ///< доступен ли участок текущему пайщику для выбора (публичный или он в белом списке)
};
