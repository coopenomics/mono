import { SovietContract } from 'cooptypes';

/** Имя расширения в реестре платформы и рабочего стола. */
export const ROBOT_EXTENSION_NAME = 'robot';

/**
 * Разрешение аккаунта члена совета, ключом которого подписывает робот.
 * Контракт принимает любое имя, кроме active и owner; платформа выпускает одно
 * и то же имя всем, чтобы интерфейс, хранилище и проверки говорили об одном.
 */
export const ROBOT_PERMISSION = 'robot';

export const SOVIET = SovietContract.contractName.production;

/** Версия протокола подписи голоса, которую принимает контракт. */
export const VOTE_VERSION = '1.0.0';
