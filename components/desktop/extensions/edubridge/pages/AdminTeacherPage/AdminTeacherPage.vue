<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="firstLoad" :count="1")

  EmptyState(v-else-if="!teacher" :title="$t('edubridge.adminTeachersPage.notFoundTitle')" :body="$t('edubridge.adminTeachersPage.notFoundBody')")
    template(#icon)
      q-icon(name="person_off" size="40px")

  template(v-else)
    //- На странице карточка лежит на белой подложке, как остальные страницы стола.
    BaseCard.edu-teacher__content(variant="default")
      .edu-teacher__crumb
        BackLink(:label="$t('edubridge.adminTeachersPage.backToRegistry')" @click="goBack")
      TeacherCard(:key="teacher.username" :teacher="teacher" @change="(updated) => (teacher = updated)" @refresh="load")
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BackLink } from '../../shared/ui/BackLink';
import { fetchTeachers, type ITeacher } from '../../entities/Teacher';
import { TeacherCard } from '../../widgets/TeacherCard';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Преподаватель на отдельной странице. Сюда ведёт кнопка «Открыть страницу» в
 * правой панели списка; содержимое то же, что в панели, — договор и
 * назначения, — но на всю ширину и со своим адресом, который можно переслать.
 */
const route = useRoute();
const router = useRouter();
const desktopStore = useDesktopStore();

const username = computed(() => String(route.params.username ?? ''));
const teacher = ref<ITeacher | null>(null);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

// Отдельного запроса одного преподавателя нет: берём его из общего списка.
async function load(): Promise<void> {
  loading.value = true;
  try {
    teacher.value = (await fetchTeachers()).find((item) => item.username === username.value) ?? null;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  void router.push({ name: 'edubridge-admin-teachers', params: { coopname: route.params.coopname } });
}

// Живое обновление: договор подписывает председатель, назначения меняют
// другие администраторы — страница узнаёт об этом по ленте изменений.
useLiveReload([EduLive.teacherContracts, EduLive.assignments], load);

// Переход с одного преподавателя на другого не пересоздаёт страницу —
// перечитываем по новому имени.
watch(username, () => load(), { immediate: true });

// Имя преподавателя — в заголовок шапки, пока открыта страница.
watch(
  () => teacher.value?.display_name || teacher.value?.username || t('edubridge.adminTeachersPage.cardFallbackTitle'),
  (title) => desktopStore.setPageTitleOverride(title),
  { immediate: true },
);

onUnmounted(() => desktopStore.clearPageTitleOverride());
</script>

<style scoped>
/* Карточка читается колонкой: на всю ширину экрана строки «подпись — значение» расползаются. */
.edu-teacher__crumb {
  margin-bottom: var(--p-4);
  font-size: var(--p-fs-body-sm);
}
.edu-teacher__content {
  max-width: 880px;
}
</style>
