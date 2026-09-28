<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NButton, NCheckbox, NInput } from 'naive-ui'
import { quotes, tryRemembered, unlock, WrongKeyError } from './vault'

// 首次进入先试一下记住的密钥，这期间不闪出输入框
const checking = ref(!quotes.value)
const key = ref('')
const remember = ref(true)
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  if (!quotes.value) await tryRemembered()
  checking.value = false
})

async function submit() {
  if (!key.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await unlock(key.value, remember.value)
  } catch (e) {
    error.value = e instanceof WrongKeyError ? '密钥不对，检查一下有没有抄错。' : `没打开：${(e as Error).message}`
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <slot v-if="quotes" />
  <form v-else-if="!checking" class="gate" @submit.prevent="submit">
    <p class="eyebrow">已加密</p>
    <p class="lede">馆藏内容仅以密文保存，输入密钥后才会在你的浏览器里解开。密钥请向持有者索取。</p>
    <NInput
      v-model:value="key"
      type="password"
      show-password-on="click"
      placeholder="密钥（区分大小写）"
      :input-props="{ autocomplete: 'off', spellcheck: false, 'aria-label': '密钥' }"
      :status="error ? 'error' : undefined"
      autofocus
    />
    <p v-if="error" class="err" role="alert">{{ error }}</p>
    <div class="row">
      <NCheckbox v-model:checked="remember">在这台设备上记住</NCheckbox>
      <NButton type="primary" attr-type="submit" :loading="busy" :disabled="!key.trim()">解锁</NButton>
    </div>
  </form>
</template>

<style scoped>
.gate {
  display: grid;
  gap: var(--s-3);
  max-width: 32rem;
  padding: var(--s-4);
  border: 1px solid var(--line);
}
.lede {
  color: var(--text-mute);
}
.err {
  color: var(--accent);
  font-size: var(--step--1);
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
}
</style>
