// Утилита для получения SystemInteractor из NestJS DI контейнера
// для использования в старых REST контроллерах

import { SystemInteractor } from '~/application/system/interactors/system.interactor';

let systemInteractor: SystemInteractor;

export function setSystemInteractor(interactor: SystemInteractor) {
  systemInteractor = interactor;
}

export async function getSystemInteractor(): Promise<SystemInteractor> {
  if (!systemInteractor) {
    // i18n-ignore: внутренняя ошибка инициализации DI-контейнера (SystemInteractor), до пайщика не доходит
    throw new Error('SystemInteractor не инициализирован');
  }
  return systemInteractor;
}
