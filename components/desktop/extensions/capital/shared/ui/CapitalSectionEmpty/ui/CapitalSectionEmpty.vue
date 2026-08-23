<template lang="pug">
.text-center.q-pa-xl.capital-section-empty
  q-icon(:name="icon", size="4rem", color="grey-5")
  .q-mt-md
    .text-h6.text-grey-7 {{ title }}
    .text-body2.text-grey-6.q-mt-sm(v-if="body") {{ body }}
  .row.justify-center.q-mt-md(v-if="$slots.action")
    slot(name="action")
</template>

<script lang="ts" setup>
withDefaults(
  defineProps<{
    icon?: string
    title: string
    body?: string
  }>(),
  {
    icon: 'inbox',
    body: undefined,
  },
)
</script>

<style lang="scss" scoped>
.capital-section-empty--centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: min(60vh, 28rem);
  width: 100%;
  box-sizing: border-box;
}
</style>
