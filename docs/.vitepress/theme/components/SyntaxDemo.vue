<script setup>
import Playground from './Playground.vue'
defineProps({ template: String, css: { type: String, default: '' }, data: { type: Object, default: () => ({}) } })
</script>
<template><ClientOnly><Playground :template="template" :css="css" :data="data" compact /><template #fallback><p>加载中…</p></template></ClientOnly></template>
