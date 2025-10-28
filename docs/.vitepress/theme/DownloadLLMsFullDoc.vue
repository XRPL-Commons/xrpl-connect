<template>
  <button
    class="llms-full-download-btn"
    @click="downloadFullDoc"
    title="Download complete documentation as markdown"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
    Download Full Docs
  </button>
</template>

<script setup lang="ts">
const downloadFullDoc = async () => {
  try {
    // Try to fetch the llms-full.txt file from the root
    const baseUrl = import.meta.env.BASE_URL || '/'
    const response = await fetch(`${baseUrl}llms-full.txt`)

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }

    const content = await response.text()

    // Create a blob and download
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'xrpl-connect-docs.md'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  } catch (error) {
    console.error('Failed to download documentation:', error)
    alert('Failed to download documentation. Please try again.')
  }
}
</script>
