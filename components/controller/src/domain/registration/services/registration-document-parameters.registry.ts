import { Injectable } from '@nestjs/common';
import type {
  IMarketplaceDocumentParametersHook,
  IProgramDocumentParametersHook,
  IProgramOfferParametersHook,
  IRegistrationDocumentParametersRegistryPort,
} from '@coopenomics/innercoop';

/**
 * Реестр хуков параметров оферт (канон авторегистрации, как у прав рабочего
 * стола — `ExtensionGrantsRegistry`).
 *
 * Расширение само кладёт сюда свою реализацию при запуске, поэтому поток
 * вступления не импортирует модуль расширений и цикла не образует. Пустой
 * слот — нормальное состояние: расширения может не быть в кооперативе.
 */
@Injectable()
export class RegistrationDocumentParametersRegistry
  implements IRegistrationDocumentParametersRegistryPort
{
  private programHook?: IProgramDocumentParametersHook;
  private marketplaceHook?: IMarketplaceDocumentParametersHook;
  private readonly programOfferHooks = new Map<string, IProgramOfferParametersHook>();

  registerProgramHook(hook: IProgramDocumentParametersHook): void {
    this.programHook = hook;
  }

  registerMarketplaceHook(hook: IMarketplaceDocumentParametersHook): void {
    this.marketplaceHook = hook;
  }

  registerProgramOfferHook(hook: IProgramOfferParametersHook): void {
    this.programOfferHooks.set(hook.programKey, hook);
  }

  /** Хук оферт программы по ключу или `undefined`, если расширение не установлено. */
  programOfferParameters(programKey: string): IProgramOfferParametersHook | undefined {
    return this.programOfferHooks.get(programKey);
  }

  /** Хук программных оферт или `undefined`, если расширение не установлено. */
  programParameters(): IProgramDocumentParametersHook | undefined {
    return this.programHook;
  }

  /** Хук оферты Стола заказов или `undefined`, если расширение не установлено. */
  marketplaceParameters(): IMarketplaceDocumentParametersHook | undefined {
    return this.marketplaceHook;
  }
}
