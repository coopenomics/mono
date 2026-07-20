import { KuBranchesPage } from 'src/pages/Ku/BranchesList';
import { KuBranchDetailsPage } from 'src/pages/Ku/BranchDetails';
import { KuMeetingsPage } from 'src/pages/Ku/MeetingsList';
import { KuMeetingDetailsPage } from 'src/pages/Ku/MeetingDetails';
import { KuMyBranchPage } from 'src/pages/Ku/MyBranch';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { markRaw } from 'vue';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [
    {
      workspace: 'trustee',
      extension_name: 'trustee',
      title: 'Кооперативный участок',
      icon: 'fa-solid fa-users-cog',
      defaultRoute: 'ku-branches',
      routes: [
        {
          meta: {
            title: 'Кооперативный участок',
            icon: 'fa-solid fa-users-cog',
            roles: [],
          },
          path: '/:coopname/ku',
          name: 'trustee',
          children: [
            {
              meta: {
                title: 'Кооперативные участки',
                icon: 'fa-solid fa-map-location-dot',
                roles: [],
                agreements: agreementsBase,
                requiresAuth: true,
              },
              path: 'branches',
              name: 'ku-branches',
              component: markRaw(KuBranchesPage),
              children: [],
            },
            {
              meta: {
                title: 'Участок',
                icon: 'fa-solid fa-map-location-dot',
                roles: [],
                agreements: agreementsBase,
                requiresAuth: true,
                hidden: true,
              },
              path: 'branches/:braname',
              name: 'ku-branch-details',
              component: markRaw(KuBranchDetailsPage),
              children: [],
            },
            {
              meta: {
                title: 'Собрания',
                icon: 'fa-solid fa-people-group',
                roles: [],
                agreements: agreementsBase,
                requiresAuth: true,
              },
              path: 'meetings',
              name: 'ku-meetings',
              component: markRaw(KuMeetingsPage),
              children: [],
            },
            {
              meta: {
                title: 'Собрание',
                icon: 'fa-solid fa-people-group',
                roles: [],
                agreements: agreementsBase,
                requiresAuth: true,
                hidden: true,
              },
              path: 'meetings/:hash',
              name: 'ku-meeting-details',
              component: markRaw(KuMeetingDetailsPage),
              children: [],
            },
            {
              meta: {
                title: 'Мой участок',
                icon: 'fa-solid fa-house-user',
                roles: [],
                agreements: agreementsBase,
                requiresAuth: true,
              },
              path: 'my-branch',
              name: 'ku-my-branch',
              component: markRaw(KuMyBranchPage),
              children: [],
            },
          ],
        },
      ],
    },
  ];
}
