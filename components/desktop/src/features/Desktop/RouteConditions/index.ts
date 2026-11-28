import { computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useSessionStore } from 'src/entities/Session';
import { useNetworkMode, useSystemStore } from 'src/entities/System/model';

/**
 * Условия показа страниц (`meta.conditions` маршрута): один контекст и один
 * вычислитель для меню стола и палитры команд. Раньше каждый держал свою
 * копию, и новое условие приходилось вписывать в обе.
 *
 * Ключи контекста:
 *  - `isCoop` — вошла учётная запись кооператива (организация-кооператив);
 *  - `userRole` — роль пайщика на узле;
 *  - `userAccount` — личные данные вошедшего;
 *  - `coopname` — кооператив узла;
 *  - `isPlatformProvider` — узел провайдера платформы: реестр кооперативов и
 *    страницы подключения кооператива к платформе живут на нём;
 *  - `isNetworked` — узел связан с провайдером подключения; у одиночного
 *    запуска подписок на приложения каталога нет;
 *  - `isOnboardingHidden` — председатель завершил онбординг.
 */
export function useRouteConditions() {
  const session = useSessionStore();
  const system = useSystemStore();
  const { isPlatformProvider, isNetworked } = useNetworkMode();

  const userRole = computed<'chairman' | 'member' | 'user'>(() =>
    session.isChairman ? 'chairman' : session.isMember ? 'member' : 'user',
  );

  const context = computed<Record<string, unknown>>(() => {
    const acc = session.currentUserAccount?.private_account;
    const isCoop =
      acc?.type === Zeus.AccountType.organization &&
      !!acc.organization_data &&
      'type' in acc.organization_data &&
      (acc.organization_data as { type: string }).type.toUpperCase() === Zeus.OrganizationType.COOP;
    return {
      isCoop: Boolean(isCoop),
      userRole: userRole.value,
      userAccount: acc,
      coopname: system.info.coopname,
      isPlatformProvider: isPlatformProvider.value,
      isNetworked: isNetworked.value,
      // Онбординг завершает председатель — отметка в настройках кооператива,
      // одна на все устройства.
      isOnboardingHidden: !!system.info.settings?.onboarding_completed_at,
    };
  });

  /** Условие маршрута выполнено; маршрут без условия виден всегда. */
  function allows(condition: string | undefined): boolean {
    if (!condition) return true;
    const ctx = context.value;
    try {
      const fn = new Function(...Object.keys(ctx), `return ${condition};`);
      return Boolean(fn(...Object.values(ctx)));
    } catch (e) {
      console.error('Error evaluating route condition:', e);
      return false;
    }
  }

  return { context, allows, userRole };
}
