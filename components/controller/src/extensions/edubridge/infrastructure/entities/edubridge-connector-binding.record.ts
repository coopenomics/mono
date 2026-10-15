import { EduAccessCarrier, EduConnectorHealth } from '../../domain/enums';

/**
 * Подключённая площадка кооператива и её состояние. Ключи API здесь НЕ лежат —
 * они в конфиге расширения под `secret:true`.
 */
export class EdubridgeConnectorBindingRecord {
  public id!: string;

  public coopname!: string;

  public carrier!: EduAccessCarrier;

  public enabled!: boolean;

  public health!: EduConnectorHealth;

  public last_check_at!: Date | null;

  public last_check_message!: string | null;

  /** Учётные данные площадки (JSON полей), зашифрованные ключом ядра (`SECRET_CIPHER_PORT`). */
  public credentials_encrypted!: string | null;

  public credentials_updated_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
