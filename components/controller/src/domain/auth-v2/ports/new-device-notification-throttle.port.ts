/** DI-токен троттла уведомлений о новом устройстве (CoopID Story 3.9, bundling NFR10). */
export const NEW_DEVICE_NOTIFICATION_THROTTLE = Symbol('NEW_DEVICE_NOTIFICATION_THROTTLE');

/**
 * Bundling-замок уведомлений о входе с нового устройства (NFR10): не более одного
 * уведомления на пайщика в 12-часовом окне. Реализация — атомарный `SET NX EX`
 * в Redis (см. {@link ../../infrastructure/auth-v2/redis-new-device-notification-throttle.store}).
 */
export interface INewDeviceNotificationThrottle {
  /**
   * Пытается занять окно уведомлений для пайщика.
   * @returns `true` — окно было свободно и теперь занято (можно слать);
   *          `false` — в окне уже было уведомление (слать НЕ нужно, bundling).
   */
  tryAcquire(subjectId: string): Promise<boolean>;
}
