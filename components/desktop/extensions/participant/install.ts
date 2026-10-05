import './i18n';
import { ProfilePage } from 'src/pages/User/ProfilePage';
import { CardcoopPage } from 'src/pages/User/CardcoopPage';
import { WalletPage } from 'src/pages/User/WalletPage';
import { MembershipExitConfirmPage } from 'src/pages/User/MembershipExitConfirmPage';
import { ConnectionAgreementPage, InstallationCompletedPage } from 'src/pages/Union/ConnectionAgreement';
import { UserPaymentMethodsPage } from 'src/pages/User/PaymentMethodsPage';
import { UserSettingsPage } from 'src/pages/User/SettingsPage';
import { ContactsPage } from 'src/pages/Contacts';
import { ListOfMeetsPage } from 'src/pages/Cooperative/ListOfMeets';
import { MeetDetailsPage } from 'src/pages/Cooperative/MeetDetails';
import { UserDocumentsPage } from 'src/pages/User/DocumentsPage';
import { DocumentDetailsPage } from 'src/pages/Cooperative/DocumentDetails';
import { UserPaymentsPage } from 'src/pages/User/PaymentsPage';
import { SupportTrigger } from 'src/pages/Support';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { markRaw } from 'vue';
import { t } from './i18n';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'participant',
    extension_name: 'participant',
    title: t('participant.install.title'),
    icon: 'fa-solid fa-user',
    defaultRoute: 'wallet', // Маршрут по умолчанию для рабочего стола пайщика
    // Страницы стола называют право из таблицы прав ядра (`requires`). Права
    // «для всех» (`Cooperative:read`, `MembershipExit:confirm`) сервер выдаёт и
    // гостю: под ними стоят страницы без входа.
    routes: [
      {
        meta: {
          title: t('participant.install.title'),
          icon: 'fa-solid fa-id-card',
          requires: 'Account:read:own',
        },
        path: '/:coopname/user',
        name: 'participant',
        children: [
          {
            meta: {
              title: t('participant.install.walletTitle'),
              icon: 'fa-solid fa-wallet',
              requires: 'Wallet:read:own',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            path: 'wallet',
            name: 'wallet',
            component: markRaw(WalletPage),
            children: [],
          },
          {
            // Подтверждение авторизуется токеном из ссылки (мутация публичная),
            // поэтому страница доступна БЕЗ входа — иначе навигационный гард
            // редиректит на login-redirect. requiresAuth:false = исключение из auth-гейта.
            meta: {
              title: t('participant.install.exitConfirmTitle'),
              icon: 'logout',
              requires: 'MembershipExit:confirm',
              requiresAuth: false,
              hidden: true,
            },
            path: 'membership-exit/confirm',
            name: 'membership-exit-confirm',
            component: markRaw(MembershipExitConfirmPage),
            children: [],
          },
          {
            meta: {
              title: t('participant.install.identityTitle'),
              icon: 'fa-solid fa-user',
              requires: 'Account:read:own',
              agreements: agreementsBase,
            },
            path: 'profile',
            name: 'profile',
            component: markRaw(ProfilePage),
            children: [],
          },
          {
            // Карта кооператора сети (story 7.4). Страница есть с эпика 7, но в сборщик стола
            // попала только 02.09.2026: прежние манифесты столов никто не читал, маршруты
            // стола пайщика собирает этот install — и карта в нём отсутствовала.
            meta: {
              title: t('participant.install.cardTitle'),
              icon: 'badge',
              requires: 'Card:read:own',
              requiresAuth: true,
            },
            path: 'cardcoop',
            name: 'user-cardcoop',
            component: markRaw(CardcoopPage),
            children: [],
          },
          {
            meta: {
              title: t('participant.install.connectionTitle'),
              icon: 'link',
              requires: 'ProviderSubscription:read:own',
              conditions: 'isCoop === true && coopname === "voskhod"',
              requiresAuth: true,
            },
            path: '/:coopname/connect',
            name: 'connect',
            component: markRaw(ConnectionAgreementPage),
            children: [
              {
                path: 'completed',
                name: 'installation-completed',
                component: markRaw(InstallationCompletedPage),
                meta: {
                  title: t('participant.install.installationCompletedTitle'),
                  icon: 'fas fa-check-circle',
                  requires: 'ProviderSubscription:read:own',
                  conditions: 'isCoop === true && coopname === "voskhod"',
                  requiresAuth: true,
                  hidden: true,
                },
              },
            ],
          },
          {
            meta: {
              title: t('participant.install.requisitesTitle'),
              icon: 'account_balance',
              requires: 'PaymentMethod:manage:own',
              requiresAuth: true,
            },
            path: '/:coopname/connect',
            name: 'payment-methods',
            component: markRaw(UserPaymentMethodsPage),
          },
          {
            meta: {
              title: t('participant.install.documentsTitle'),
              icon: 'fa-solid fa-file-invoice',
              requires: 'Document:read:own',
              requiresAuth: true,
            },
            path: 'documents',
            name: 'user-documents',
            component: markRaw(UserDocumentsPage),
            children: [
              {
                // Отдельная страница документа (deep-link из поиска и реестра).
                meta: {
                  title: t('participant.install.documentTitle'),
                  requires: 'Document:read:own',
                  requiresAuth: true,
                  hidden: true,
                },
                path: ':hash',
                name: 'user-document-details',
                component: markRaw(DocumentDetailsPage),
              },
            ],
          },
          {
            meta: {
              title: t('participant.install.paymentsTitle'),
              icon: 'fa-solid fa-money-bill-transfer',
              requires: 'Payment:read:own',
              requiresAuth: true,
            },
            path: 'payments',
            name: 'user-payments',
            component: markRaw(UserPaymentsPage),
          },
          {
            meta: {
              title: t('participant.install.meetingsTitle'),
              icon: 'fa-solid fa-users-between-lines',
              requires: 'Meet:read',
              requiresAuth: true,
            },
            path: 'meets',
            name: 'user-meets',
            component: markRaw(ListOfMeetsPage),
            children: [
              {
                path: ':hash',
                name: 'user-meet-details',
                component: markRaw(MeetDetailsPage),
                meta: {
                  title: t('participant.install.meetingDetailsTitle'),
                  icon: 'fa-solid fa-users-between-lines',
                  requires: 'Meet:read',
                  requiresAuth: true,
                },
              },
            ],
          },
          {
            path: '/:coopname/contacts',
            name: 'contacts',
            component: markRaw(ContactsPage),
            meta: {
              title: t('participant.install.contactsTitle'),
              icon: 'fa-solid fa-info',
              requires: 'Cooperative:read',
            },
          },
          {
            // Предпоследний пункт (перед «Поддержкой»): пароль, 2FA, активные
            // сессии, PIN-код. Здесь же, в опасной зоне внизу страницы, живёт
            // выход из кооператива — отдельного пункта меню у него больше нет.
            meta: {
              title: t('participant.install.settingsTitle'),
              // Material-иконка: канон запрещает FontAwesome в новых правках,
              // соседние fa-* — легаси и меняются попутно при их правке.
              icon: 'settings',
              requires: 'Account:read:own',
              agreements: agreementsBase,
            },
            path: 'settings',
            name: 'user-settings',
            component: markRaw(UserSettingsPage),
            children: [],
          },
          {
            meta: {
              title: t('participant.install.supportTitle'),
              icon: 'fa-solid fa-headset',
              requires: 'Account:read:own',
              requiresAuth: true,
              action: 'toggleSupportChat',
            },
            path: '/:coopname/support',
            name: 'support',
            component: markRaw(SupportTrigger),
            children: [],
          },
        ],
      },
    ],
  }];
}
