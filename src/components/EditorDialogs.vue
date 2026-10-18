<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import ExportDialog from './ExportDialog.vue';
import HelpDialog from './HelpDialog.vue';
import NewDialog from './NewDialog.vue';

const e = useEditor();
</script>
<template>
  <NewDialog :open="e.dialog === 'new'" />
  <ExportDialog :open="e.dialog === 'export'" />
  <HelpDialog :open="e.dialog === 'help'" />
</template>
