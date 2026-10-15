<template lang="pug">
div
  // Режим простых чипов (для таблиц)
  template(v-if='mode === "chips"')
    q-chip(
      v-if='segment.is_author',
      :size='size',
      color='purple',
      text-color='white',
      dense
    ) {{ $t('capital.roleBadges.coauthor') }}
    q-chip(
      v-if='segment.is_creator',
      :size='size',
      color='blue',
      text-color='white',
      dense
    ) {{ $t('capital.roleBadges.performer') }}
    q-chip(
      v-if='segment.is_coordinator',
      :size='size',
      color='indigo',
      text-color='white',
      dense
    ) {{ $t('capital.roleBadges.coordinator') }}
    //- q-chip(
    //-   v-if='segment.is_investor || segment.is_propertor',
    //-   :size='size',
    //-   color='green',
    //-   text-color='white',
    //-   dense
    //- ) Инвестор
    q-chip(
      v-if='segment.is_contributor',
      :size='size',
      color='teal',
      text-color='white',
      dense
    ) {{ $t('capital.roleBadges.member') }}

  // Режим карточек с аватарами (для детального просмотра)
  template(v-else-if='mode === "cards"')
    .row.q-gutter-sm.justify-center
      q-card(
        v-if='segment.is_author',
        flat,
        class='role-card purple-border'
      )
        q-card-section.q-pa-sm
          .row.items-center.q-gutter-sm
            q-avatar(:size='avatarSize', color='purple', text-color='white')
              q-icon(name='edit', size='sm')
            .col
              .text-caption.text-weight-medium {{ $t('capital.roleBadges.coauthor') }}
      q-card(
        v-if='segment.is_creator',
        flat,
        class='role-card blue-border'
      )
        q-card-section.q-pa-sm
          .row.items-center.q-gutter-sm
            q-avatar(:size='avatarSize', color='blue', text-color='white')
              q-icon(name='engineering', size='sm')
            .col
              .text-caption.text-weight-medium {{ $t('capital.roleBadges.performer') }}
      q-card(
        v-if='segment.is_coordinator',
        flat,
        class='role-card indigo-border'
      )
        q-card-section.q-pa-sm
          .row.items-center.q-gutter-sm
            q-avatar(:size='avatarSize', color='indigo', text-color='white')
              q-icon(name='groups', size='sm')
            .col
              .text-caption.text-weight-medium {{ $t('capital.roleBadges.coordinator') }}
      q-card(
        v-if='segment.is_investor',
        flat,
        class='role-card green-border'
      )
        q-card-section.q-pa-sm
          .row.items-center.q-gutter-sm
            q-avatar(:size='avatarSize', color='green', text-color='white')
              q-icon(name='trending_up', size='sm')
            .col
              .text-caption.text-weight-medium {{ $t('capital.roleBadges.investor') }}
      q-card(
        v-if='segment.is_contributor',
        flat,
        class='role-card teal-border'
      )
        q-card-section.q-pa-sm
          .row.items-center.q-gutter-sm
            q-avatar(:size='avatarSize', color='teal', text-color='white')
              q-icon(name='stars', size='sm')
            .col
              .text-caption.text-weight-medium {{ $t('capital.roleBadges.member') }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';

interface Props {
  segment: any;
  mode: 'chips' | 'cards';
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm'
});

const avatarSize = computed(() => {
  switch (props.size) {
    case 'sm': return '24px';
    case 'md': return '32px';
    case 'lg': return '40px';
    default: return '32px';
  }
});
</script>

<style lang="scss" scoped>
.role-card {
  border-radius: 12px;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.purple-border {
  border-left: 4px solid #9c27b0;
}

.blue-border {
  border-left: 4px solid #1976d2;
}

.indigo-border {
  border-left: 4px solid #3f51b5;
}

.green-border {
  border-left: 4px solid #4caf50;
}

.teal-border {
  border-left: 4px solid #009688;
}
</style>
