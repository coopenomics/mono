import type { CreateOrganizationDataInputDomainInterface } from '~/domain/account/interfaces/create-organization-data-input-domain.interface';

export interface InitInputDomainInterface {
  organization_data: CreateOrganizationDataInputDomainInterface;
  // Если true — инициализация инициирована провайдером (через server-secret),
  // флаг init_by_server проставляется в true безусловно. Если undefined/false —
  // сохраняется текущая логика: setInitByServer(true) только при первой init.
  is_server_init?: boolean;
}
