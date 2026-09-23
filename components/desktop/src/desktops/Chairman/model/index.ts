import { UserPaymentMethodsPage } from 'src/pages/User/PaymentMethodsPage';
import { UserSettingsPage } from 'src/pages/User/SettingsPage';
import { markRaw } from 'vue';
import { t } from 'src/shared/i18n';

export const manifest = {
  'name': 'ChairmanDesktop',
  'hash': 'hash2',
  'authorizedHome': 'home',
  'nonAuthorizedHome': 'signup',
  'routes': [
    {
      meta: {
        title: t('desktop.chairmanMenu.memberItem'),
        icon: 'fa-solid fa-id-card',
        roles: [],
      },
      path: '/:coopname/user',
      name: 'home',
      children: [{
          meta: {
            title: t('desktop.chairmanMenu.requisitesItem'),
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
            title: t('desktop.chairmanMenu.settingsItem'),
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
