<script setup lang="ts">
import { LOCALES, locale, setLocale, t } from '../../i18n';
import { useExportStore } from '../../stores/export';
import { useFilesStore } from '../../stores/files';
import { useUiStore } from '../../stores/ui';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import ProjectName from './ProjectName.vue';

const files = useFilesStore();
const exporter = useExportStore();
const ui = useUiStore();
</script>

<template>
  <header class="topbar">
    <a
      class="brand"
      href="#"
      :aria-label="t('topbar.brandAria')"
      @click.prevent="ui.openDialog('new')"
    >
      <span class="brand-mark"><i></i><i></i><i></i></span>
      <span
        >ROAD<span class="brand-light">BUILDER</span><small>ASSETTO CORSA TRACK STUDIO</small></span
      >
      <span class="version">0.1</span>
    </a>
    <ProjectName />
    <nav class="actions" :aria-label="t('topbar.projectAria')">
      <AppButton id="new-project" class="collapsible" @click="ui.openDialog('new')">
        <AppIcon name="plus" /><span>{{ t('topbar.new') }}</span>
      </AppButton>
      <AppButton id="open-project" class="collapsible" @click="files.openProject()">
        <AppIcon name="folder" /><span>{{ t('topbar.open') }}</span>
      </AppButton>
      <AppButton
        id="save-project"
        class="collapsible"
        variant="secondary"
        @click="files.saveProject()"
      >
        <AppIcon name="save" /><span>{{ t('topbar.save') }}</span>
      </AppButton>
      <span class="divider"></span>
      <AppButton id="export-project" variant="primary" @click="exporter.open()">
        <AppIcon name="export" />{{ t('topbar.export')
        }}<span class="wide-only"> {{ t('topbar.exportTrack') }}</span>
      </AppButton>
      <span class="divider"></span>
      <AppButton
        id="open-help"
        :aria-label="t('sidebar.help')"
        :title="t('sidebar.help')"
        @click="ui.openDialog('help')"
      >
        <AppIcon name="help" />
      </AppButton>
      <div class="locale-switch" role="group" :aria-label="t('topbar.language')">
        <button
          v-for="code in LOCALES"
          :id="`locale-${code}`"
          :key="code"
          type="button"
          :aria-pressed="locale === code"
          @click="setLocale(code)"
        >
          {{ code.toUpperCase() }}
        </button>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  border-bottom: 1px solid var(--line);
  gap: 20px;
  background: var(--topbar);
}
.brand {
  text-decoration: none;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.6px;
  flex-shrink: 0;
}
.brand-light {
  font-weight: 400;
}
.brand small {
  display: block;
  font-size: 8px;
  color: var(--muted);
  letter-spacing: 2.1px;
  font-weight: 500;
  margin-top: 4px;
}
.brand-mark {
  width: 36px;
  height: 36px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transform: skewX(-21deg);
}
.brand-mark i {
  background: var(--accent);
  width: 7px;
  height: 30px;
}
.brand-mark i:nth-child(2) {
  height: 21px;
}
.brand-mark i:nth-child(3) {
  height: 13px;
}
.version {
  font-size: 9px;
  font-family: monospace;
  letter-spacing: 0;
  border: 1px solid #3d4936;
  padding: 3px 5px;
  color: var(--accent);
  align-self: flex-start;
  margin-top: 3px;
  border-radius: 4px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.divider {
  width: 1px;
  height: 26px;
  background: var(--line);
  margin: 0 8px;
}
.locale-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.locale-switch button {
  min-height: 30px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 550;
  letter-spacing: 0.04em;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #b7c2c1;
}
.locale-switch button:hover {
  background: var(--hover);
}
.locale-switch button[aria-pressed='true'] {
  background: var(--pressed);
  color: var(--accent);
}
@media (max-width: 1200px) {
  .actions .button {
    padding: 9px 10px;
  }
}
@media (max-width: 950px) {
  .topbar {
    padding: 0 18px;
    gap: 12px;
    height: 68px;
  }
  .brand {
    font-size: 16px;
    gap: 8px;
  }
  .brand small {
    font-size: 7px;
    letter-spacing: 1.5px;
  }
  .brand-mark {
    width: 28px;
  }
  .version,
  .wide-only,
  .divider,
  .collapsible > span {
    display: none;
  }
  .actions {
    gap: 5px;
  }
}
@media (max-width: 650px) {
  .topbar {
    height: auto;
    min-height: 65px;
    padding: 12px;
    flex-wrap: wrap;
  }
  .brand {
    font-size: 17px;
  }
  .actions {
    margin-left: auto;
  }
  .actions .button {
    min-height: 34px;
    padding: 7px;
    --icon-size: 16px;
  }
  #new-project {
    display: none;
  }
}
</style>
