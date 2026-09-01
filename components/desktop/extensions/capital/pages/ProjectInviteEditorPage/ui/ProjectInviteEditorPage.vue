<template lang="pug">
ProjectInviteEditor(:placeholder='invitePlaceholder || "Введите приглашение..."')
</template>

<script lang="ts" setup>
import { ProjectInviteEditor } from 'app/extensions/capital/widgets/ProjectInviteEditor';

defineProps<{
  invitePlaceholder?: string;
}>();
</script>
