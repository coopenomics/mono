/** Ключ разрешения робота, переданный членом совета; хранится зашифрованным. */
export interface RobotKeyDomainEntity {
  id: string;
  coopname: string;
  member: string;
  permission_name: string;
  encrypted_wif: string;
  public_key: string;
  created_at: Date;
  updated_at: Date;
}
