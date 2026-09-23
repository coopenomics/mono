<template lang="pug">
div
  // Лоадер пока идет загрузка
  WindowLoader(v-if="loading", :text="$t('capital.projectInvitePage.loadingText')")

  // Основной контент после загрузки
  div.q-pa-md(v-else)
    // Заголовок страницы
    .text-h4.q-mb-md {{ $t('capital.projectInvitePage.title') }}

    // Путь проекта
    ProjectPathWidget(
      :project="project"
      class="q-mb-md"
    )

    // Контент в зависимости от наличия инвайта
    template(v-if="project?.invite")
      // Полный виджет инвайта
      InviteWidget(
        :invite="project.invite"
      )

      // Кнопка отклика
      .q-mt-md.text-center
        MakeClearanceButton(
          :project="project"
        )

    template(v-else)
      // Заглушка если нет инвайта
      .text-center.q-pa-lg
        .text-h6.q-mb-md {{ $t('capital.projectInvitePage.noActiveTitle') }}
        .text-body2.text-grey-6
          | {{ $t('capital.projectInvitePage.noActiveText') }}

</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { WindowLoader } from 'src/shared/ui/Loader';
import { useBackButton } from 'src/shared/lib/navigation';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { InviteWidget } from 'app/extensions/capital/widgets';
import { ProjectPathWidget } from 'app/extensions/capital/widgets/ProjectPathWidget';
import { MakeClearanceButton } from 'app/extensions/capital/features/Contributor/MakeClearance';
import { t } from '../../../i18n';

// Используем composable для загрузки проекта
const { project, projectHash, loadProject } = useProjectLoader();

// Настраиваем кнопку "Назад"
useBackButton({
  text: t('common.action.back'),
  componentId: 'project-invite-' + projectHash.value,
});

const loading = ref(false);

// Обновляем loading состояние на основе наличия проекта
watch(project, (newProject) => {
  loading.value = !newProject;
});

// Инициализация
onMounted(async () => {
  await loadProject();
});
</script>
