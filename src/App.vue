<script setup lang="ts">
import { onMounted } from 'vue';
import { useSessionLifecycle } from './app/useSessionLifecycle';
import ExportDialog from './components/dialogs/ExportDialog.vue';
import HelpDialog from './components/dialogs/HelpDialog.vue';
import NewDialog from './components/dialogs/NewDialog.vue';
import AppToast from './components/layout/AppToast.vue';
import TopBar from './components/layout/TopBar.vue';
import ProjectSidebar from './components/sidebar/ProjectSidebar.vue';
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
    <ProjectSidebar />
    <TrackWorkspace class="main" />
  </main>
  <NewDialog />
  <ExportDialog />
  <HelpDialog />
  <AppToast />
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 288px minmax(0, 1fr);
  height: calc(100dvh - 78px);
  min-height: 670px;
}
@media (min-width: 1500px) {
  .layout {
    grid-template-columns: 308px minmax(0, 1fr);
  }
}
@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 258px minmax(0, 1fr);
  }
}
@media (max-width: 950px) {
  .layout {
    height: calc(100dvh - 68px);
    grid-template-columns: 238px minmax(0, 1fr);
  }
}
@media (max-width: 650px) {
  .layout {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 0;
  }
  .main {
    order: -1;
    height: 680px;
  }
}
</style>
