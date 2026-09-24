import { UserPaymentMethodsPage } from 'src/pages/User/PaymentMethodsPage';
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
        title: t('desktop.setupMenu.memberItem'),
        icon: 'fa-solid fa-id-card',
        roles: [],
      },
      path: '/:coopname/user',
      name: 'home',
      children: [{
          meta: {
            title: t('desktop.setupMenu.requisitesItem'),
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
