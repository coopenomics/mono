<template lang="pug">
  div.q-pa-md

    // Сетка проектов с инвайтами
    .row.q-gutter-md(v-if="projects.length > 0")
      ColorCard(
        color="blue"
        v-for="project in projects"
        :key="project.project_hash"
        class="col-xs-12 col-md-6"
        @click="handleDetailsClick(project.project_hash)"
        style="cursor: pointer;"
      )
        // Путь проекта
        ProjectPathWidget(
          :project="project"
        ).full-width.text-center.q-mb-sm

        // Виджет для отображения сокращенного invite
        ShortInviteWidget(
          v-if="project.invite"
          :invite="project.invite"
          :project-hash="project.project_hash"
          @details="handleDetailsClick"
        )

    // Текст при отсутствии приглашений
    div(v-else)
      div.text-body2.text-grey-7 {{ $t('capital.projectsInvitesPage.emptyText') }}
</template>
<script lang="ts" setup>
  import { ref, onMounted } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CAPITAL_LIVE_TABLES } from 'app/extensions/capital/shared/lib/live';
  import { useRouter } from 'vue-router';
  import { useSystemStore } from 'src/entities/System/model';
  import { FailAlert } from 'src/shared/api';
  import { ColorCard } from 'src/shared/ui/ColorCard';
  import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
  import type { IProject } from 'app/extensions/capital/entities/Project/model';
  import { ShortInviteWidget } from 'app/extensions/capital/widgets';
  import { ProjectPathWidget } from 'app/extensions/capital/widgets/ProjectPathWidget';
import { t } from '../../../i18n';

  const router = useRouter();
  const { info } = useSystemStore();

  const projects = ref<IProject[]>([]);
  const loading = ref(false);

  // Загрузка проектов с инвайтами
  const loadProjectsWithInvites = async () => {
    loading.value = true;
    try {
      const result = await ProjectApi.loadProjects({
        filter: {
          coopname: info.coopname,
          has_invite: true,
          is_component: true,
        },
        pagination: {
          page: 1,
          limit: 100, // Загружаем все проекты с инвайтами
        },
      });

      projects.value = result.items || [];
    } catch (error) {
      console.error('Ошибка при загрузке проектов с инвайтами:', error);
      FailAlert(t('capital.projectsInvitesPage.loadError'));
    } finally {
      loading.value = false;
    }
  };


  // Обработчик клика на кнопку "Подробности"
  const handleDetailsClick = (projectHash: string) => {
    router.push({
      name: 'project-invite',
      params: { project_hash: projectHash }
    });
  };


  // Инициализация
  // Проекты с приглашениями живут по ленте изменений Благороста.
  useLiveReload(CAPITAL_LIVE_TABLES, () => loadProjectsWithInvites());

  onMounted(async () => {
    await loadProjectsWithInvites();
  });
  </script>
