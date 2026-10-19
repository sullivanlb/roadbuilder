<script setup lang="ts">
/** A labelled on/off switch. */
defineProps<{ id: string; label: string; note?: string }>();
const checked = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="toggle" :for="id">
    <span
      >{{ label }}<small v-if="note">{{ note }}</small></span
    >
    <input :id="id" v-model="checked" type="checkbox" />
    <span class="switch" aria-hidden="true"></span>
  </label>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  position: relative;
  cursor: pointer;
  justify-content: space-between;
  font-size: 11px;
  margin-top: 6px;
}
small {
  display: block;
  font-size: 10px;
  color: var(--faint);
  margin-top: 5px;
}
input {
  position: absolute;
  right: 0;
  width: 34px;
  height: 20px;
  opacity: 0;
  cursor: pointer;
}
.switch {
  width: 31px;
  height: 18px;
  border-radius: 12px;
  background: #475452;
  padding: 3px;
  pointer-events: none;
}
.switch::after {
  content: '';
  display: block;
  width: 12px;
  height: 12px;
  background: #a6afaa;
  border-radius: 100%;
  transition: transform 0.2s;
}
input:checked + .switch {
  background: #b2d46b;
}
input:checked + .switch::after {
  background: #25371b;
  transform: translateX(13px);
}
input:focus-visible + .switch {
  outline: 2px solid white;
  outline-offset: 3px;
}
</style>
