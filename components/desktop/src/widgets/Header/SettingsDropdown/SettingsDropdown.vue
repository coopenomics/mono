<template lang="pug">
q-btn-dropdown(
  flat,
  :size='isMobile ? "sm" : "md"',
  :dense='isMobile',
  stretch,
  icon='fa-solid fa-cog'
)
  q-list
    ToogleDarkLight(:isMobile='isMobile', :showText='true')

    q-item(
      v-if='loggedIn && (isChairman || isMember)',
      flat,
      clickable,
      v-close-popup,
      @click='open("members")'
    )
      q-item-section
        q-item-label
          q-icon.q-mr-sm(name='fa-solid fa-hammer')
          span.font10px НАСТРОЙКИ КООПЕРАТИВА

    q-item(
      flat,
      v-if='isChairman',
      clickable,
      v-close-popup,
      @click='open("extstore-showcase")'
    )
      q-item-section
        q-item-label
          q-icon.q-mr-sm(name='fa-solid fa-plus')
          span.font10px МАГАЗИН РАСШИРЕНИЙ
</template>
<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { ToogleDarkLight } from '../../../shared/ui/ToogleDarkLight';
import { useCurrentUser } from 'src/entities/Session';
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';

const session = useSessionStore();

const currentUser = useCurrentUser();
const loggedIn = computed(
  () => currentUser.isRegistrationComplete.value && session.isAuth,
);

defineProps({
  isMobile: Boolean,
  isChairman: {
    type: Boolean,
    default: false,
    required: false,
  },
  isMember: {
    type: Boolean,
    default: false,
    required: false,
  },
});

const router = useRouter();
const open = (name: string) => {
  router.push({ name });
};
</script>

<style>
.font10px {
  font-size: 10px;
}
</style>
