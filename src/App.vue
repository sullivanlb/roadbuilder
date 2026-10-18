<script setup lang="ts">
import { provideEditor } from './composables/useEditor';
import IconDefinitions from './components/ui/IconDefinitions.vue';
import TopBar from './components/layout/TopBar.vue';
import ProjectSidebar from './components/sidebar/ProjectSidebar.vue';
import TrackEditor from './components/workspace/TrackEditor.vue';
import EditorDialogs from './components/dialogs/EditorDialogs.vue';
const e = provideEditor();
</script>
<template>
  <IconDefinitions />
  <TopBar />
  <main class="workspace">
    <ProjectSidebar />
    <TrackEditor />
  </main>
  <EditorDialogs />
  <div
    id="toast"
    class="toast"
    role="status"
    aria-live="polite"
    :hidden="!e.notification.message"
    :class="{ error: e.notification.error }"
  >
    {{ e.notification.message }}
  </div>
</template>
