export interface BlockchainAccountInterface {
  account_name: string;
  head_block_num: number;
  head_block_time: string;
  privileged: boolean;
  last_code_update: string;
  created: string;
  core_liquid_balance?: string;
  ram_quota: number;
  net_weight: string;
  cpu_weight: string;
  net_limit: AccountResourceInfo;
  cpu_limit: AccountResourceInfo;
  ram_usage: number;
  permissions: Permission[];
  total_resources: ResourceOverview | null;
  self_delegated_bandwidth: ResourceDelegation | null;
  refund_request: RefundRequest | null;
  voter_info: any;
  rex_info: any;
}

export interface AccountResourceInfo {
  used: string;
  available: string;
  max: string;
  last_usage_update_time?: string;
  current_used?: string;
}

export interface Authority {
  threshold: number;
  keys: KeyWeight[];
  accounts: PermissionLevelWeight[];
  waits: WaitWeight[];
}
export interface KeyWeight {
  key: string;
  weight: number;
}
export interface Permission {
  perm_name: string;
  parent: string;
  required_auth: Authority;
  /**
   * Время последнего изменения permission (block_timestamp, ISO-8601). Отдаётся
   * нодой в `get_account`. По нему проверяется финализация активного ключа
   * (Story 9.6): пока last_updated новее границы LIB — смена ключа реверсивна.
   * Опционально: старые ноды/моки могут не возвращать поле.
   */
  last_updated?: string;
}
export interface PermissionLevel {
  actor: string;
  permission: string;
}
export interface PermissionLevelWeight {
  permission: PermissionLevel;
  weight: number;
}
export interface WaitWeight {
  wait_sec: number;
  weight: number;
}

export interface ResourceOverview {
  owner: string;
  ram_bytes: number;
  net_weight: string;
  cpu_weight: string;
}

export interface ResourceDelegation {
  from: string;
  to: string;
  net_weight: string;
  cpu_weight: string;
}

export interface RefundRequest {
  owner: string;
  request_time: string;
  net_amount: string;
  cpu_amount: string;
}
