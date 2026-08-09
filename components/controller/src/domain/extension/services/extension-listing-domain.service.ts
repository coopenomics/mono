import { Injectable } from '@nestjs/common';
import { ExtensionDomainService } from './extension-domain.service';
import { ExtensionDomainEntity, isExtensionAvailable, type IResolvedRegistryExtension } from '@coopenomics/extension-kit';
import { ExtensionDTO } from '~/application/appstore/dto/extension-graphql.dto';
import { AppRegistry } from '~/extensions/extensions.registry';
import zodToJsonSchema from 'zod-to-json-schema';
import type { GetExtensionsGraphQLInput } from '~/application/appstore/dto/get-extensions-input.dto';
import appConfig from '~/config/config';

/**
 * Новый доменный сервис, занимающийся сборкой информации о расширениях:
 *   - объединяет данные AppRegistry (описание, schema...) и базы (конфиг, enabled...).
 *   - валидирует config по Zod-схеме, если нужно.
 */
@Injectable()
export class ExtensionDomainListingService<TConfig = any> {
  constructor(
    // Через конструктор можно вызывать методы, которые работают с установленными расширениями:
    private readonly extensionDomainService: ExtensionDomainService<TConfig>
  ) {}

  /**
   * Возвращает полный список (каталог + установленные), с учётом фильтра
   */
  async getCombinedAppList(filter?: GetExtensionsGraphQLInput): Promise<ExtensionDTO<TConfig>[]> {
    // 1) Собираем данные реестра
    const registryDataMap = await this.extractRegistryData();
    // 2) Список установленных
    const installedList = await this.extensionDomainService.getAppList();

    // Создаём карту для объединённых
    const combined = new Map<string, ExtensionDTO<TConfig>>();

    // Сначала все из реестра (как неустановленные)
    for (const [key, regData] of Object.entries(registryDataMap)) {
      const dto = await this.buildDTO(key, null, regData);
      combined.set(key, dto);
    }

    // Дополняем установленными
    for (const installed of installedList) {
      const regData = registryDataMap[installed.name];
      // добавляем если приложение найдено
      if (regData) {
        const dto = await this.buildDTO(installed.name, installed, regData);
        combined.set(installed.name, dto);
      }
    }

    // Фильтрация (по имени, enabled, installed и т.д.)
    let result = Array.from(combined.values());
    if (filter) {
      result = result.filter((ext) => Object.entries(filter).every(([k, v]) => ext[k] === v));
    }

    return result;
  }

  /**
   * Возвращает один объект ExtensionDTO или null
   */
  async getCombinedApp(name: string): Promise<ExtensionDTO<TConfig> | null> {
    const registryDataMap = await this.extractRegistryData();
    const regData = registryDataMap[name];
    if (!regData) return null;

    const installed = await this.extensionDomainService.getAppByName(name);
    return this.buildDTO(name, installed, regData);
  }

  /**
   * Запрещает установку приложения, которое в этой сети не открыто.
   *
   * Проверка обязана быть на сервере: скрытая карточка в интерфейсе не мешает
   * вызвать мутацию установки напрямую.
   */
  assertInstallable(name: string): void {
    const ext = AppRegistry[name];
    if (!ext) throw new Error(`Приложение ${name} не найдено в реестре`);
    if (!isExtensionAvailable(ext.availability, appConfig.blockchain.is_mainnet)) {
      throw new Error(`Приложение ${name} недоступно для установки`);
    }
  }

  /**
   * Проверяет конфиг по Zod-схеме из AppRegistry
   */
  validateConfig(name: string, config: any): void {
    const ext = AppRegistry[name];
    if (!ext) throw new Error(`Приложение ${name} не найдено в реестре`);
    const result = ext.schema.safeParse(config);
    if (!result.success) {
      const errors = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('; ');
      throw new Error(`Ошибка валидации конфигурации: ${errors}`);
    }
  }

  // ==========================================
  // Вспомогательные методы (приватные)
  // ==========================================

  /**
   * Собирает DTO, объединяя поля из базы (установленное расширение) и реестра
   */
  private async buildDTO(
    name: string,
    installed: ExtensionDomainEntity<TConfig> | null,
    registryData: IResolvedRegistryExtension
  ): Promise<ExtensionDTO<TConfig>> {
    const dto = new ExtensionDTO(name, registryData, installed);

    // readme/instructions — это Promise<string>, дожидаемся
    dto.readme = await registryData.readme;
    dto.instructions = await registryData.instructions;
    return dto;
  }

  /**
   * Получаем карту {key: IResolvedRegistryExtension} с преобразованной схемой (Zod → JSON)
   * и доступностью, вычисленной для сети, в которой работает этот узел.
   */
  private async extractRegistryData(): Promise<Record<string, IResolvedRegistryExtension>> {
    const map: Record<string, IResolvedRegistryExtension> = {};

    for (const [key, ext] of Object.entries(AppRegistry)) {
      const { schema, availability, ...rest } = ext;
      map[key] = {
        ...rest,
        is_available: isExtensionAvailable(availability, appConfig.blockchain.is_mainnet),
        schema: zodToJsonSchema(schema),
      };
    }

    return map;
  }
}
