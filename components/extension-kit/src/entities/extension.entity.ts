/**
 * Установленное расширение: имя, включённость, конфиг и версия схемы конфига.
 * Конфиг типизируется расширением через `TConfig` (обычно `z.infer<typeof Schema>`).
 */
export interface ExtensionDomainInterface<TConfig = any> {
  name: string;
  enabled: boolean;
  config: TConfig;
  schema_version?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class ExtensionDomainEntity<TConfig = any> implements ExtensionDomainInterface<TConfig> {
  constructor(
    public readonly name: string,
    public readonly enabled: boolean,
    public readonly config: TConfig,
    public readonly created_at: Date,
    public readonly updated_at: Date,
    public readonly schema_version: number = 1
  ) {}
}
