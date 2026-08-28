<script setup>
import { XamanAdapter } from 'xrpl-connect';

const adapter = new XamanAdapter({ apiKey: 'publish-smoke-test' });
</script>

<template>
  <main>{{ adapter.name }}</main>
</template>
