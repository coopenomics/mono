import './i18n';
import { markRaw } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { refreshMenuBadges, registerMenuBadge } from 'src/shared/lib/menuBadges';
import { registerLiveReload, type ChainTableRef } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { api as approvalsApi } from 'app/extensions/chairman/entities/Approval/api';
import { ExtensionsShowcase } from 'src/pages/ExtensionStore/ExtensionsShowcase';
import { InstalledExtensions } from 'src/pages/ExtensionStore/InstalledExtensions';
import { ExtensionPage } from 'src/pages/ExtensionStore/ExtensionPage';
import { ExtensionsManagement } from 'src/pages/ExtensionStore/ExtensionsManagement';
import { MemberBranchList } from 'src/pages/Cooperative/MemberBranchList';
import { ChangeRegisterPaymentsPage } from 'src/pages/Cooperative/ChangeRegisterPayments';
import { ChangeCooperativeContacts } from 'src/pages/Cooperative/ChangeContacts';
import { MembersPage } from 'src/pages/Cooperative/MembersPage';
import { CooperativeKeyPage } from 'src/pages/Cooperative/CooperativeKey';
import { ApprovalsPage } from 'app/extensions/chairman/pages/ApprovalsPage';
import { SystemSettingsPage } from 'app/extensions/chairman/pages/SystemSettingsPage';
import { PaymentProviderPage } from 'app/extensions/chairman/pages/PaymentProviderPage';
import { ConnectPage } from 'app/extensions/chairman/pages/ConnectPage';
import { AgendaPresetsPage } from 'app/extensions/chairman/pages/AgendaPresetsPage';
import { NotificationsJournalPage } from 'src/pages/Chairman/NotificationsJournalPage';

import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { t } from './i18n';

export default async function (): Promise<IWorkspaceConfig[]> {
  // Число на пункте «Запросы одобрений»: сколько документов ждёт подписи
  // председателя. Меняется по ленте одобрений — подпись, отказ, новый запрос.
  const APPROVALS_TABLE: ChainTableRef = { code: 'chairman', table: 'chairman_approvals' };
  registerMenuBadge('approvals', async () => {
    try {
      const { info } = useSystemStore();
      const page = await approvalsApi.loadApprovals({
        filter: { coopname: info.coopname, statuses: [Zeus.ApprovalStatus.PENDING] },
        options: { page: 1, limit: 1 },
      });
      return page?.totalCount ?? 0;
    } catch {
      // Одобрения читает только председатель — остальным число не показывается.
      return 0;
    }
  });
  registerLiveReload([APPROVALS_TABLE], () => refreshMenuBadges(['approvals']));

  return [{
    workspace: 'chairman',
    extension_name: 'chairman',
    title: t('chairman.install.extensionName'),
    icon: 'fa-solid fa-user-tie',
    defaultRoute: 'approvals', // Маршрут по умолчанию для рабочего стола председателя
    routes: [
      {
        meta: {
          title: t('chairman.install.extensionName'),
          icon: 'fa-solid fa-user-tie',
          requires: 'System:manage',
        },
        path: '/:coopname/chairman',
        name: 'chairman',
        children: [
          {
            path: 'connect',
            name: 'chairman-connect',
            component: markRaw(ConnectPage),
            meta: {
              title: t('chairman.install.onboardingNavTitle'),
              icon: 'fa-solid fa-rocket',
              requires: 'System:manage',
              agreements: agreementsBase,
              requiresAuth: true,
              conditions: '!isOnboardingHidden',
            },
          },
          {
            path: 'agenda-presets',
            name: 'chairman-agenda-presets',
            component: markRaw(AgendaPresetsPage),
            meta: {
              title: t('chairman.install.agendaPresetsNavTitle'),
              icon: 'fa-solid fa-file-alt',
              requires: 'System:manage',
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
          },
          {
            path: 'approvals',
            name: 'approvals',
            component: markRaw(ApprovalsPage),
            meta: {
              title: t('chairman.install.approvalsNavTitle'),
              icon: 'fa-solid fa-check-circle',
              requires: 'Approval:confirm',
              agreements: agreementsBase,
              requiresAuth: true,
            },
          },
          {
            path: 'notifications-journal',
            name: 'chairman-notifications-journal',
            component: markRaw(NotificationsJournalPage),
            meta: {
              title: t('chairman.install.notificationsLogNavTitle'),
              icon: 'notifications',
              requires: 'NotificationJournal:resend',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'extensions',
            name: 'extensions',
            component: markRaw(ExtensionsManagement),
            meta: {
              title: t('chairman.install.appCatalogNavTitle'),
              icon: 'fa-solid fa-puzzle-piece',
              requires: 'Extension:manage',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            redirect: { name: 'extstore-showcase' },
            children: [
              {
                path: 'showcase',
                name: 'extstore-showcase',
                component: markRaw(ExtensionsShowcase),
                meta: {
                  title: t('chairman.install.marketplaceNavTitle'),
                  icon: 'fa-solid fa-store',
                  requires: 'Extension:manage',
                  requiresAuth: true,
                },
              },
              {
                path: 'installed',
                name: 'appstore-installed',
                component: markRaw(InstalledExtensions),
                meta: {
                  title: t('chairman.install.installedAppsNavTitle'),
                  icon: 'fa-solid fa-download',
                  requires: 'Extension:manage',
                  requiresAuth: true,
                },
              },
              {
                path: 'extension/:name',
                name: 'one-extension',
                component: markRaw(ExtensionPage),
                meta: {
                  title: t('chairman.install.extensionNavTitle'),
                  icon: 'fa-solid fa-cog',
                  requires: 'Extension:manage',
                  requiresAuth: true,
                },
                children: [
                  {
                    path: 'settings',
                    name: 'extension-settings',
                    component: markRaw(ExtensionPage),
                    meta: {
                      title: t('chairman.install.appSettingsNavTitle'),
                      icon: 'fa-solid fa-cog',
                      requires: 'Extension:manage',
                      requiresAuth: true,
                    },
                  },
                  {
                    path: 'install',
                    name: 'extension-install',
                    component: markRaw(ExtensionPage),
                    meta: {
                      title: t('chairman.install.appInstallNavTitle'),
                      icon: 'fa-solid fa-download',
                      requires: 'Extension:manage',
                      requiresAuth: true,
                    },
                  },
                ],
              },
            ],
          },
          {
            path: 'system-settings',
            name: 'system-settings',
            component: markRaw(SystemSettingsPage),
            meta: {
              title: t('chairman.install.defaultPagesNavTitle'),
              icon: 'fa-solid fa-house',
              requires: 'System:manage',
              agreements: agreementsBase,
              requiresAuth: true,
            },
          },
          {
            path: 'settings/members',
            name: 'members',
            component: markRaw(MembersPage),
            meta: {
              title: t('chairman.install.councilMembersNavTitle'),
              icon: 'fa-solid fa-users',
              requires: 'Account:update',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/branches',
            name: 'branches',
            component: markRaw(MemberBranchList),
            meta: {
              title: t('chairman.install.cooperativeUnitsNavTitle'),
              icon: 'fa-solid fa-sitemap',
              requires: 'Branch:manage',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/initial-contributions',
            name: 'initial-contributions',
            component: markRaw(ChangeRegisterPaymentsPage),
            meta: {
              title: t('chairman.install.registrationFeesNavTitle'),
              icon: 'fa-solid fa-coins',
              requires: 'System:manage',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/cooperative-key',
            name: 'cooperative-key',
            component: markRaw(CooperativeKeyPage),
            meta: {
              title: t('chairman.install.cooperativeKeyNavTitle'),
              icon: 'fa-solid fa-key',
              requires: 'System:manage',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/payment-provider',
            name: 'payment-provider',
            component: markRaw(PaymentProviderPage),
            meta: {
              title: t('chairman.install.paymentProviderNavTitle'),
              icon: 'fa-solid fa-credit-card',
              requires: 'System:manage',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'settings/change-contacts',
            name: 'change-contacts',
            component: markRaw(ChangeCooperativeContacts),
            meta: {
              title: t('chairman.install.cooperativeContactsNavTitle'),
              icon: 'fa-solid fa-address-book',
              requires: 'System:manage',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
        ],
      },
    ],
  }];
}
