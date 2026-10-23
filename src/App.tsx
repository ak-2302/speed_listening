import { useEffect, useRef, useState } from 'react'
import { makeWav } from './audio'
import SpeechWorker from './speech.worker?worker'
import './style.css'

type Status = 'idle' | 'loading' | 'generating' | 'ready' | 'error'
type WorkerResult = { type: 'ready', transferredBytes: number | null } | { type: 'audio', pcm: Float32Array, sampleRate: number } | { type: 'error', message: string }
const MAX_LENGTH = 100

export default function App() {
  const [text, setText] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [size, setSize] = useState<number>()
  const [transferredBytes, setTransferredBytes] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const worker = useRef<Worker | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const pendingText = useRef('')
  const initialized = useRef(false)
  const base = new URL(import.meta.env.BASE_URL, window.location.href).href

  useEffect(() => {
    fetch(`${base}assets/size.json`).then((response) => response.ok ? response.json() : Promise.reject()).then((data: { bytes: number }) => setSize(data.bytes)).catch(() => {})
  }, [base])
  useEffect(() => () => { worker.current?.terminate() }, [])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  function createWorker() {
    const instance = new SpeechWorker()
    worker.current = instance
    instance.onmessage = (event: MessageEvent<WorkerResult>) => {
      const result = event.data
      if (result.type === 'ready') {
        initialized.current = true
        setTransferredBytes(result.transferredBytes)
        setStatus('generating')
        instance.postMessage({ type: 'synthesize', text: pendingText.current })
      } else if (result.type === 'audio') {
        if (!result.pcm.length || !result.sampleRate) {
          setError('音声を生成できませんでした。文章を変えてお試しください。')
          setStatus('error')
          return
        }
        setAudioUrl(URL.createObjectURL(makeWav(result.pcm, result.sampleRate)))
        setGeneratedText(pendingText.current)
        setStatus('ready')
      } else {
        setError('音声の準備または生成に失敗しました。接続を確認し、再試行してください。')
        setStatus('error')
        initialized.current = false
        instance.terminate()
        worker.current = null
      }
    }
    instance.onerror = () => {
      setError('音声の準備に失敗しました。接続を確認し、再試行してください。')
      setStatus('error')
      initialized.current = false
      instance.terminate()
      worker.current = null
    }
    return instance
  }

  function generate() {
    if (!text.trim()) {
      setError('文章を入力してください。')
      setStatus('error')
      return
    }
    audio.current?.pause()
    setPlaying(false)
    setError('')
    pendingText.current = text
    const instance = worker.current ?? createWorker()
    if (initialized.current) {
      setStatus('generating')
      instance.postMessage({ type: 'synthesize', text })
    } else {
      setStatus('loading')
      instance.postMessage({ type: 'initialize', base })
    }
  }

  async function togglePlayback() {
    const player = audio.current
    if (!player) return
    if (!player.paused) { player.pause(); return }
    try { await player.play() } catch { setError('再生できませんでした。再生ボタンをもう一度押してください。') }
  }

  const busy = status === 'loading' || status === 'generating'
  const stale = Boolean(audioUrl && text !== generatedText)
  return (
    <main className="page">
      <header className="heading">
        <p className="eyebrow">LISTENING PRACTICE</p>
        <h1>文章を、聞いてみる。</h1>
        <p>好きな文章を入力して、音声で聞く練習を始めましょう。</p>
      </header>
      <section className="workspace" aria-labelledby="input-title">
        <div className="field-heading"><label id="input-title" htmlFor="text">文章</label><span>{text.length} / {MAX_LENGTH} 文字</span></div>
        <textarea id="text" maxLength={MAX_LENGTH} value={text} onChange={(event) => setText(event.target.value)} placeholder="ここに日本語の文章を入力、または貼り付けてください。" />
        <p className="hint">入力した文章はこのブラウザ内で音声に変換します。最大 {MAX_LENGTH} 文字は暫定です。</p>
        <button className="primary" type="button" onClick={generate} disabled={busy}>{status === 'error' ? 'もう一度生成する' : '音声を生成する'} <span aria-hidden="true">→</span></button>
        <div className="status" role="status" aria-live="polite">
          {status === 'loading' && '音声データを準備しています。初回は時間がかかる場合があります。'}
          {status === 'generating' && '音声を生成しています…'}
          {error && <span className="error">{error}</span>}
          {status === 'ready' && !error && (stale ? '文章が変更されています。新しい文章を聞くには、もう一度生成してください。' : '音声の準備ができました。')}
        </div>
        <div className="playback">
          <div><p className="playback-label">音声を聞く</p><p className="hint">{audioUrl ? (stale ? '変更前の文章の音声です' : '生成した音声を再生できます') : '文章から音声を生成すると再生できます'}</p></div>
          <button className="play" type="button" disabled={!audioUrl} onClick={togglePlayback}>{playing ? '一時停止' : '再生'}</button>
          <audio ref={audio} src={audioUrl || undefined} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        </div>
      </section>
      <p className="footnote">初回の音声データ取得量：{size ? `約 ${(size / 1024 / 1024).toFixed(1)} MiB（ファイルの合計）` : '確認できません'}。通信量は圧縮やキャッシュにより異なります。{transferredBytes !== null && ` 今回の音声データ取得時の転送量：約 ${(transferredBytes / 1024 / 1024).toFixed(1)} MiB（ブラウザ計測）。`}</p>
    </main>
  )
}
