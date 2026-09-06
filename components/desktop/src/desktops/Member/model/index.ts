import { CardcoopPage } from 'src/pages/User/CardcoopPage';
import { UserPaymentMethodsPage } from 'src/pages/User/PaymentMethodsPage';
import { UserSettingsPage } from 'src/pages/User/SettingsPage';
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
            title: 'Карта кооператора',
            icon: 'badge',
            roles: [],
          },
          path: 'cardcoop',
          name: 'user-cardcoop',
          component: markRaw(CardcoopPage),
          children: [],
        },
        {
          meta: {
            title: 'Реквизиты',
            icon: '',
            roles: [],
          },
          path: 'payment-methods',
          name: 'user-payment-methods',
          component: markRaw(UserPaymentMethodsPage),
          children: [],
        },
        {
          meta: {
            title: 'Настройки',
            icon: 'settings',
            roles: [],
          },
          path: 'settings',
          name: 'user-settings',
          component: markRaw(UserSettingsPage),
          children: [],
        }
      ],
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
