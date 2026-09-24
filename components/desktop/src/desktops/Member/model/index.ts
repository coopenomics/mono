import { CardcoopPage } from 'src/pages/User/CardcoopPage';
import { UserPaymentMethodsPage } from 'src/pages/User/PaymentMethodsPage';
import { UserProgramsPage } from 'src/pages/User/ProgramsPage';
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
        title: t('desktop.memberMenu.memberItem'),
        icon: 'fa-solid fa-id-card',
        roles: [],
      },
      path: '/:coopname/user',
      name: 'home',
      children: [{
          meta: {
            title: t('desktop.memberMenu.cardItem'),
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
            title: t('desktop.memberMenu.requisitesItem'),
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
            title: t('desktop.memberMenu.programsItem'),
            icon: 'handshake',
            roles: [],
          },
          path: 'programs',
          name: 'user-programs',
          component: markRaw(UserProgramsPage),
          children: [],
        },
        {
          meta: {
            title: t('desktop.memberMenu.settingsItem'),
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
