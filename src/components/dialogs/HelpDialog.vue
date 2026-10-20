<script setup lang="ts">
import { RULES } from '../../core/project/rules';
import { t } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useUiStore } from '../../stores/ui';
import BaseDialog from '../ui/BaseDialog.vue';

const ui = useUiStore();

/** Letter keys are shown as is; combinations are spelled in the interface language. */
const shortcuts: { label: MessageKey; key: () => string }[] = [
  { label: 'help.shortcutLayers', key: () => '1 – 6' },
  { label: 'help.shortcutView', key: () => 'C' },
  { label: 'help.shortcutSelect', key: () => 'V' },
  { label: 'help.shortcutAdd', key: () => 'A' },
  { label: 'help.shortcutBarrier', key: () => 'B' },
  { label: 'help.shortcutPits', key: () => 'P' },
  { label: 'help.shortcutWidth', key: () => 'L' },
  { label: 'help.shortcutPan', key: () => 'H' },
  { label: 'help.shortcutFit', key: () => 'F' },
  { label: 'help.shortcutUndo', key: () => t('help.keyCtrlZ') },
  { label: 'help.shortcutRedo', key: () => t('help.keyCtrlShiftZ') },
  { label: 'topbar.save', key: () => t('help.keyCtrlS') },
  { label: 'help.shortcutDelete', key: () => t('help.keyDelete') },
];
</script>

<template>
  <BaseDialog
    id="help-dialog"
    :open="ui.dialog === 'help'"
    :eyebrow="t('help.eyebrow')"
    :title="t('help.title')"
    @close="ui.closeDialog()"
  >
    <ol class="steps">
      <li>
        <strong>{{ t('help.step1Title') }}</strong
        >{{ t('help.step1') }}
      </li>
      <li>
        <strong>{{ t('help.step2Title') }}</strong
        >{{ t('help.step2') }}
      </li>
      <li>
        <strong>{{ t('help.step3Title') }}</strong
        >{{ t('help.step3') }}
      </li>
      <li>
        <strong>{{ t('help.step4Title') }}</strong
        >{{ t('help.step4Before') }}<em>{{ t('layers.edges') }}</em
        >{{ t('help.step4After') }}
      </li>
      <li>
        <strong>{{ t('help.step5Title') }}</strong
        >{{ t('help.step5') }}
      </li>
    </ol>
    <div class="shortcuts">
      <span v-for="shortcut in shortcuts" :key="shortcut.label"
        >{{ t(shortcut.label) }} <kbd>{{ shortcut.key() }}</kbd></span
      >
    </div>
    <p class="note">
      {{ t('help.note1', { maxPoints: RULES.points.max, maxBarriers: RULES.barriers.max }) }}
    </p>
    <p class="note">{{ t('help.note2') }}</p>
  </BaseDialog>
</template>

<style scoped>
.steps {
  padding-left: 22px;
  margin: 23px 0;
}
li {
  padding: 0 0 18px 7px;
  font-size: 12px;
  color: #98aaa2;
  line-height: 1.8;
}
li::marker {
  color: var(--accent);
  font-family: monospace;
}
strong {
  display: block;
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
}
.shortcuts {
  border: 1px solid #35433e;
  padding: 18px;
  border-radius: 7px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 30px;
}
.shortcuts > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #a9b9af;
  font-size: 10px;
}
.note {
  color: #91a19c;
  font-size: 11px;
  line-height: 1.8;
  margin-top: 20px;
}
@media (max-width: 650px) {
  .shortcuts {
    gap: 12px 15px;
    padding: 13px;
  }
  .shortcuts > span {
    font-size: 9px;
  }
}
</style>
