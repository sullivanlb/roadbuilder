<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import { useModalDialog } from '../composables/useModalDialog';
import { LIMITS } from '../domain/project/limits';
import { t } from '../i18n';

const props = defineProps<{ open: boolean }>();
const e = useEditor();
const dialog = useModalDialog(() => props.open);
</script>
<template>
  <dialog
    id="help-dialog"
    ref="dialog"
    aria-labelledby="help-title"
    @cancel.prevent="e.openDialog(null)"
  >
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">{{ t('help.eyebrow') }}</span>
        <h2 id="help-title">{{ t('help.title') }}</h2>
      </div>
      <button
        class="tool"
        data-close="help-dialog"
        :aria-label="t('dialog.close')"
        @click="e.openDialog(null)"
      >
        <svg class="icon"><use href="#i-close" /></svg>
      </button>
    </div>
    <ol class="guide-steps">
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
        >{{ t('help.step4Before') }}<em>{{ t('barriers.title') }}</em
        >{{ t('help.step4After') }}
      </li>
      <li>
        <strong>{{ t('help.step5Title') }}</strong
        >{{ t('help.step5') }}
      </li>
    </ol>
    <div class="shortcuts">
      <span>{{ t('help.shortcutSelect') }} <kbd>V</kbd></span
      ><span>{{ t('help.shortcutAdd') }} <kbd>A</kbd></span
      ><span>{{ t('help.shortcutBarrier') }} <kbd>B</kbd></span
      ><span>{{ t('help.shortcutPan') }} <kbd>H</kbd></span
      ><span>{{ t('help.shortcutFit') }} <kbd>F</kbd></span
      ><span
        >{{ t('help.shortcutUndo') }} <kbd>{{ t('help.keyCtrlZ') }}</kbd></span
      ><span
        >{{ t('help.shortcutRedo') }} <kbd>{{ t('help.keyCtrlShiftZ') }}</kbd></span
      ><span
        >{{ t('topbar.save') }} <kbd>{{ t('help.keyCtrlS') }}</kbd></span
      ><span
        >{{ t('help.shortcutDelete') }} <kbd>{{ t('help.keyDelete') }}</kbd></span
      >
    </div>
    <p class="dialog-note">
      {{ t('help.note1', { maxPoints: LIMITS.points, maxBarriers: LIMITS.barriers }) }}
    </p>
    <p class="dialog-note">{{ t('help.note2') }}</p>
  </dialog>
</template>
