<template lang="pug">
div
  q-select(
    label="Кооперативный участок"
    v-model="selectedBranch"
    :options="branches"
    option-value="braname"
    option-label="full_name"
    emit-value
    standout="bg-teal text-white"
    map-options
  )

    template(v-slot:option="scope")
      q-item(v-bind="scope.itemProps")
        q-item-section
          q-item-label(style="font-weight: bold;") {{ scope.opt.full_name }}
          q-item-label(caption) {{ scope.opt.fact_address }}

    template(v-slot:selected-item="scope")
      q-avatar(text-color="black" icon="home" size="md")
      q-item-section.q-mt-sm
        q-item-label(style="font-weight: bold;") {{ scope.opt.full_name }}
        q-item-label() {{ scope.opt.fact_address }}
  </template>

  <script lang="ts" setup>
  import { type IPublicBranch } from 'src/entities/Branch/model';

  defineProps({
    branches: {
      type: Object as () => IPublicBranch[],
      required: true,
    },
  })

  const selectedBranch = defineModel<string>('selectedBranch', { default: '' })
  </script>
