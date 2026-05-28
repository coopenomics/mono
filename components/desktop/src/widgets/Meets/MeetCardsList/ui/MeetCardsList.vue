<template lang="pug">
.meet-cards-list
  .meet-cards-list__items(v-if='loading')
    span.skel.meet-cards-list__skel(v-for='i in 3', :key='i')

  EmptyState(
    v-else-if='!meets.length',
    title='Нет общих собраний',
    body='У кооператива пока нет предстоящих или проведённых общих собраний.'
  )
    template(#icon)
      q-icon(name='event_busy', size='48px')

  .meet-cards-list__items(v-else)
    MeetCompactCard(
      v-for='meet in meets',
      :key='meet.hash',
      :meet='meet',
      @navigate='navigateToMeetDetails(meet)'
    )
</template>

<script setup lang="ts">
import { MeetCompactCard } from 'src/shared/ui/MeetCompactCard';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import type { IMeet } from 'src/entities/Meet';
import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';

defineProps<{
  meets: IMeet[];
  loading: boolean;
}>();

const router = useRouter();
const desktop = useDesktopStore();

// Навигация к деталям собрания
const navigateToMeetDetails = (meet: IMeet) => {
  const currentWorkspace = desktop.activeWorkspaceName;
  const isSoviet = currentWorkspace === 'soviet';

  const routeName = isSoviet ? 'meet-details' : 'user-meet-details';

  router.push({
    name: routeName,
    params: {
      hash: meet.hash,
      coopname: router.currentRoute.value.params.coopname,
    },
  });
};
</script>

<style lang="scss" scoped>
.meet-cards-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
}
.meet-cards-list__skel {
  display: block;
  width: 100%;
  height: 168px;
  border-radius: var(--p-r-lg, 16px);
}
</style>
