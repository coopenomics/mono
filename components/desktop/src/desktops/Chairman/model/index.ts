import { UserPaymentMethodsPage } from 'src/pages/User/PaymentMethodsPage';
import { ResourceMonitorPage } from 'src/pages/PowerUp/ResourceMonitorPage';
import { markRaw } from 'vue';

export const manifest = {
  'name': 'ChairmanDesktop',
  'hash': 'hash2',
  'authorizedHome': 'home',
  'nonAuthorizedHome': 'signup',
  'routes': [
    {
      meta: {
        title: 'Пайщик',
        icon: 'fa-solid fa-id-card',
        roles: [],
      },
      path: '/:coopname/user',
      name: 'home',
      children: [{
          meta: {
            title: 'Реквизиты',
            icon: '',
            roles: [],
          },
          path: 'payment-methods',
          name: 'user-payment-methods',
          component: markRaw(UserPaymentMethodsPage),
          children: [],
        }
      ],
    },
    // Epic 13 v5.1 — пакетный монитор PowerupPlugin (CPU/NET/RAM + 8 guards).
    // Доступен только chairman'у (управляет пакетной моделью и настройками).
    {
      meta: {
        title: 'Пакетные ресурсы',
        icon: 'fa-solid fa-bolt',
        roles: [],
      },
      path: '/:coopname/powerup',
      name: 'powerup',
      component: markRaw(ResourceMonitorPage),
      children: [],
    },
  ],
  'config': {
    'layout': 'default',
    'theme': 'light'
  },
  'schemas': {
    'layout': 'avj schema here',
    'theme': 'avj schema here'
  }
}
