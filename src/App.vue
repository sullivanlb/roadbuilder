<script setup lang="ts">
import { provideEditor } from './composables/useEditor';
import IconDefinitions from './components/IconDefinitions.vue';
import TopBar from './components/TopBar.vue';
import ProjectSidebar from './components/ProjectSidebar.vue';
import TrackEditor from './components/TrackEditor.vue';
import EditorDialogs from './components/EditorDialogs.vue';
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
