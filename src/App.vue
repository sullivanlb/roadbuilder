<script setup lang="ts">
import { onMounted } from 'vue';
import { useSessionLifecycle } from './app/useSessionLifecycle';
import ExportDialog from './components/dialogs/ExportDialog.vue';
import HelpDialog from './components/dialogs/HelpDialog.vue';
import NewDialog from './components/dialogs/NewDialog.vue';
import LayerInspector from './components/inspector/LayerInspector.vue';
import AppToast from './components/layout/AppToast.vue';
import LayerRail from './components/layout/LayerRail.vue';
import TopBar from './components/layout/TopBar.vue';
import TrackWorkspace from './components/workspace/TrackWorkspace.vue';
import { useShortcuts } from './editor/useShortcuts';
import { initLocale } from './i18n';

useSessionLifecycle();
useShortcuts();
onMounted(initLocale);
</script>

<template>
  <TopBar />
  <main class="layout">
    <LayerRail class="rail" />
    <TrackWorkspace class="main" />
    <LayerInspector class="side" />
  </main>
  <NewDialog />
  <ExportDialog />
  <HelpDialog />
  <AppToast />
</template>

<style scoped>
/* Layers on the left, the plan in the middle, the active layer's settings on the right. */
.layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 300px;
  height: calc(100dvh - 78px);
  min-height: 620px;
}
@media (min-width: 1500px) {
  .layout {
    grid-template-columns: 220px minmax(0, 1fr) 330px;
  }
}
@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 180px minmax(0, 1fr) 270px;
  }
}
@media (max-width: 950px) {
  .layout {
    height: calc(100dvh - 68px);
  }
}
@media (max-width: 860px) {
  .layout {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 0;
  }
  .main {
    height: 680px;
  }
}
</style>
