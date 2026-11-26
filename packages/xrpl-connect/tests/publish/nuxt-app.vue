<script setup>
import 'xrpl-connect/register';
import { XamanAdapter } from 'xrpl-connect/xaman';

const adapter = new XamanAdapter({ apiKey: 'publish-smoke-test' });
</script>

<template>
  <main>
    {{ adapter.name }}
    <xrpl-wallet-connector />
  </main>
</template>
