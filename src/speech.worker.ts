type SpeechModule = {
  configure: (dictionary: string, voice: string) => Promise<void>
  synthesize: (text: string, options: string) => { pcm: number[], sampleRate: number }
}
type Result = { pcm: Float32Array, sampleRate: number }
type SpeechRequest = { type: 'initialize', base: string } | { type: 'synthesize', text: string }
let speech: SpeechModule | undefined

function joinAudio(results: Result[]): Result {
  const sampleRate = results[0].sampleRate
  if (results.some((result) => result.sampleRate !== sampleRate)) throw new Error('音声の形式が一致しません。')
  const pcm = new Float32Array(results.reduce((sum, result) => sum + result.pcm.length, 0))
  let offset = 0
  for (const result of results) {
    pcm.set(result.pcm, offset)
    offset += result.pcm.length
  }
  return { pcm, sampleRate }
}

function synthesizeText(engine: SpeechModule, text: string): Result {
  const characters = Array.from(text)
  if (characters.length > 30) {
    const chunks: string[] = []
    while (characters.length) {
      let end = Math.min(characters.length, 30)
      if (characters.length > 30) {
        let boundary = -1
        for (let i = 0; i < end; i++) if ('。！？、\n'.includes(characters[i])) boundary = i
        if (boundary >= 9) end = boundary + 1
      }
      const chunk = characters.splice(0, end).join('')
      if (chunk.trim()) chunks.push(chunk)
    }
    if (!chunks.length) throw new Error('文章が空です。')
    return joinAudio(chunks.map((chunk) => synthesizeText(engine, chunk)))
  }
  try {
    const result = engine.synthesize(text, '{}')
    return { pcm: Float32Array.from(result.pcm), sampleRate: result.sampleRate }
  } catch (error) {
    if (characters.length < 2) throw error
    const middle = Math.ceil(characters.length / 2)
    return joinAudio([
      synthesizeText(engine, characters.slice(0, middle).join('')),
      synthesizeText(engine, characters.slice(middle).join('')),
    ])
  }
}

globalThis.addEventListener('message', async (event: MessageEvent<SpeechRequest>) => {
  try {
    if (event.data.type === 'initialize') {
      const base = event.data.base
      const runtime = `${base}assets/runtime/openjtalk-wasm-wrapper-D6E3BSJO.js`
      const imported = await import(/* @vite-ignore */ runtime)
      const instance = await imported.createOpenJTalkModule({
        locateFile: (file: string) => file.endsWith('.wasm') ? `${base}assets/runtime/openjtalk-wasm.wasm` : file,
      }) as SpeechModule
      await instance.configure(`${base}assets/dic`, `${base}assets/tohoku-f01-neutral.htsvoice`)
      speech = instance
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      const fetched = resources.filter((entry) => entry.name.startsWith(`${base}assets/`))
      const measuredBytes = fetched.reduce((sum, entry) => sum + entry.transferSize, 0)
      const transferredBytes = measuredBytes > 0 ? measuredBytes : null
      globalThis.postMessage({ type: 'ready', transferredBytes })
    } else {
      if (!speech) throw new Error('音声合成の準備ができていません。')
      const result = synthesizeText(speech, event.data.text)
      globalThis.postMessage({ type: 'audio', ...result }, { transfer: [result.pcm.buffer] })
    }
  } catch (error) {
    globalThis.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
})

export {}
