<template lang="pug">
ProjectDescriptionEditor(:placeholder='descriptionPlaceholder || "Введите описание компонента..."')
</template>

<script lang="ts" setup>
import { ProjectDescriptionEditor } from 'app/extensions/capital/widgets/ProjectDescriptionEditor';

defineProps<{
  descriptionPlaceholder?: string;
}>();
</script>
