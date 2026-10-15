<template lang="pug">
ProjectDescriptionEditor(:placeholder='descriptionPlaceholder || $t("capital.projectDescriptionPage.placeholder")')
</template>

<script lang="ts" setup>
import { ProjectDescriptionEditor } from 'app/extensions/capital/widgets/ProjectDescriptionEditor';

defineProps<{
  descriptionPlaceholder?: string;
}>();
</script>
