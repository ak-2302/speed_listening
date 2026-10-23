import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { makeWav } from './audio'
import SpeechWorker from './speech.worker?worker'
import type { Material } from './materials'
import './style.css'

type Status = 'idle' | 'loading' | 'generating' | 'ready' | 'error'
type WorkerResult = { type: 'ready', transferredBytes: number | null } | { type: 'audio', pcm: Float32Array, sampleRate: number } | { type: 'error', message: string }
type PracticeResult = { materialId: string, completedAt: string, speed: number, score: number, total: number }
type Mode = 'custom' | 'materials'
type MaterialIndex = { id: string, title: string, path: string }
const MAX_LENGTH = 100
const RESULTS_KEY = 'speed-listening-results'

export default function App() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('custom')
  const [showIntro, setShowIntro] = useState(true)
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialLoadError, setMaterialLoadError] = useState('')
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [size, setSize] = useState<number>()
  const [transferredBytes, setTransferredBytes] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [repeat, setRepeat] = useState(false)
  const [testStarted, setTestStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [testError, setTestError] = useState('')
  const [testScore, setTestScore] = useState<number | null>(null)
  const [history, setHistory] = useState<PracticeResult[]>([])
  const [storageNotice, setStorageNotice] = useState('')
  const worker = useRef<Worker | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const pendingText = useRef('')
  const initialized = useRef(false)
  const base = new URL(import.meta.env.BASE_URL, window.location.href).href

  useEffect(() => {
    fetch(`${base}assets/size.json`).then((response) => response.ok ? response.json() : Promise.reject()).then((data: { bytes: number }) => setSize(data.bytes)).catch(() => {})
  }, [base])
  useEffect(() => {
    fetch(`${base}materials/index.json`).then((response) => response.ok ? response.json() as Promise<MaterialIndex[]> : Promise.reject())
      .then((index) => Promise.all(index.map((entry) => fetch(`${base}${entry.path}`).then((response) => response.ok ? response.json() as Promise<Material> : Promise.reject()))))
      .then(setMaterials)
      .catch(() => setMaterialLoadError('問題集を読み込めませんでした。ページを再読み込みしてください。'))
  }, [base])
  useEffect(() => () => { worker.current?.terminate() }, [])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])
  useEffect(() => {
    if (audio.current) {
      audio.current.playbackRate = speed
      audio.current.defaultPlaybackRate = speed
      audio.current.preservesPitch = true
    }
  }, [speed, audioUrl])

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
        setCurrentTime(0)
        setDuration(0)
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

  function generate(inputText = text) {
    if (!inputText.trim()) {
      setError('文章を入力してください。')
      setStatus('error')
      return
    }
    audio.current?.pause()
    setPlaying(false)
    setError('')
    pendingText.current = inputText
    const instance = worker.current ?? createWorker()
    if (initialized.current) {
      setStatus('generating')
      instance.postMessage({ type: 'synthesize', text })
    } else {
      setStatus('loading')
      instance.postMessage({ type: 'initialize', base })
    }
  }

  function selectMaterial(id: string) {
    const material = materials.find((item) => item.id === id)
    if (!material) return
    audio.current?.pause()
    setPlaying(false)
    setMode('materials')
    setSelectedMaterialId(id)
    setText(material.body)
    setGeneratedText('')
    setAudioUrl('')
    setStatus('idle')
    setError('')
    setTestStarted(false)
    setAnswers({})
    setTestError('')
    setTestScore(null)
    generate(material.body)
    try {
      const stored = localStorage.getItem(RESULTS_KEY)
      const records = stored ? JSON.parse(stored) as PracticeResult[] : []
      setHistory(records.filter((record) => record.materialId === id).sort((a, b) => b.completedAt.localeCompare(a.completedAt)))
      setStorageNotice('')
    } catch {
      setHistory([])
      setStorageNotice('保存済みの結果を読み込めませんでした。')
    }
  }

  function changeMode(nextMode: Mode) {
    audio.current?.pause()
    setPlaying(false)
    setMode(nextMode)
    setSelectedMaterialId('')
    setText('')
    setGeneratedText('')
    setAudioUrl('')
    setStatus('idle')
    setError('')
    setTestStarted(false)
    setAnswers({})
    setTestError('')
    setTestScore(null)
    setHistory([])
    setStorageNotice('')
  }

  function enterMode(nextMode: Mode) {
    changeMode(nextMode)
    setShowIntro(false)
  }

  function returnToTop() {
    audio.current?.pause()
    setPlaying(false)
    setShowIntro(true)
  }

  async function togglePlayback() {
    const player = audio.current
    if (!player) return
    if (!player.paused) { player.pause(); return }
    try { await player.play() } catch { setError('再生できませんでした。再生ボタンをもう一度押してください。') }
  }

  function seek(event: ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value)
    if (audio.current) audio.current.currentTime = next
    setCurrentTime(next)
  }

  function resetPlayback() {
    if (audio.current) audio.current.currentTime = 0
    setCurrentTime(0)
  }

  function formatTime(value: number) {
    if (!Number.isFinite(value)) return '0:00'
    const minutes = Math.floor(value / 60)
    const seconds = Math.floor(value % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  const selectedMaterial = materials.find((item) => item.id === selectedMaterialId)
  function startTest() {
    if (!selectedMaterial || !audioUrl || stale) return
    setTestStarted(true)
    setTestError('')
    setTestScore(null)
  }

  function answerQuestion(questionId: string, choiceId: string) {
    setAnswers((current) => ({ ...current, [questionId]: choiceId }))
    setTestError('')
  }

  function submitTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedMaterial) return
    const unanswered = selectedMaterial.questions.filter((question) => !answers[question.id])
    if (unanswered.length) {
      setTestError(`未回答の問題があります（残り${unanswered.length}問）。`)
      return
    }
    setTestError('')
    const score = selectedMaterial.questions.filter((question) => answers[question.id] === question.answerId).length
    setTestScore(score)
    const record: PracticeResult = { materialId: selectedMaterial.id, completedAt: new Date().toISOString(), speed, score, total: selectedMaterial.questions.length }
    try {
      const stored = localStorage.getItem(RESULTS_KEY)
      const records = stored ? JSON.parse(stored) as PracticeResult[] : []
      const next = [record, ...records].slice(0, 50)
      localStorage.setItem(RESULTS_KEY, JSON.stringify(next))
      setHistory(next.filter((item) => item.materialId === selectedMaterial.id))
      setStorageNotice('今回の結果をこのブラウザに保存しました。')
    } catch {
      setStorageNotice('結果を保存できませんでした。今回の採点結果は表示しています。')
    }
  }

  function retryTest() {
    setAnswers({})
    setTestError('')
    setTestScore(null)
  }

  function formatCompletedAt(value: string) {
    return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  }

  const busy = status === 'loading' || status === 'generating'
  const stale = Boolean(audioUrl && text !== generatedText)
  return (
    <main className="page">
      {showIntro && <div className="intro-backdrop"><section className="intro-modal" role="dialog" aria-modal="true" aria-labelledby="intro-title">
        <p className="eyebrow">LISTENING PRACTICE</p>
        <h2 id="intro-title">速聴トレーニングへようこそ</h2>
        <p>文章を耳で聞きながら、聞く速さと理解する力を鍛えられます。使い方を選んで始めてください。</p>
        <div className="intro-options">
          <button type="button" className="intro-option" onClick={() => enterMode('custom')}><strong>自作の文章</strong><span>好きな文章を入力して、音声で聞きます。</span></button>
          <button type="button" className="intro-option" onClick={() => enterMode('materials')}><strong>問題集</strong><span>教材を聞いて、理解度テストに挑戦します。</span></button>
        </div>
      </section></div>}
      <button type="button" className="top-back" onClick={returnToTop}>← トップに戻る</button>
      {mode === 'materials' && <section className="materials" aria-labelledby="materials-title">
        <div className="section-heading"><h2 id="materials-title">教材から選ぶ</h2><span>{materials.length}件</span></div>
        {materialLoadError && <p className="error" role="alert">{materialLoadError}</p>}
        <div className="material-list">
          {materials.map((material) => <button className={`material-card${selectedMaterialId === material.id ? ' selected' : ''}`} type="button" key={material.id} onClick={() => selectMaterial(material.id)}><strong>{material.title}</strong><span>{material.body.length}文字・問題 {material.questions.length}問</span></button>)}
        </div>
        {selectedMaterialId && <p className="hint material-note">教材を選択しました。音声の準備ができたら再生してください。問題の正解と解説は採点後に表示します。</p>}
      </section>}
      <section className="workspace" aria-labelledby={mode === 'custom' ? 'input-title' : 'playback-title'}>
        {mode === 'custom' && <><div className="field-heading"><label id="input-title" htmlFor="text">文章</label><span>{text.length} / {MAX_LENGTH} 文字</span></div>
          <textarea id="text" maxLength={MAX_LENGTH} value={text} onChange={(event) => { setText(event.target.value); setSelectedMaterialId(''); setMode('custom') }} placeholder="ここに日本語の文章を入力、または貼り付けてください。" />
          <button className="primary" type="button" onClick={() => generate()} disabled={busy}>{status === 'error' ? 'もう一度生成する' : status === 'ready' && !stale ? '再生成する' : '音声を生成する'} <span aria-hidden="true">→</span></button></>}
        <div className="status" role="status" aria-live="polite">
          {status === 'loading' && <><span>音声データを準備しています。初回は時間がかかる場合があります。</span><span className="progress-track" role="progressbar" aria-label="音声モデルの準備中" aria-valuetext="準備中"><span className="progress-indeterminate" /></span></>}
          {status === 'generating' && <><span>{mode === 'materials' ? '教材音声を準備しています…' : '音声を生成しています…'}</span><span className="progress-track" role="progressbar" aria-label={mode === 'materials' ? '教材音声の準備中' : '音声の生成中'} aria-valuetext={mode === 'materials' ? '準備中' : '生成中'}><span className="progress-indeterminate" /></span></>}
          {error && <span className="error">{error}</span>}
          {status === 'ready' && !error && (stale ? '文章が変更されています。新しい文章を聞くには、もう一度生成してください。' : '音声の準備ができました。')}
        </div>
        <div className="playback">
          <div><p className="playback-label" id="playback-title">音声を聞く</p><p className="hint">{audioUrl ? (stale ? '変更前の文章の音声です' : '生成した音声を再生できます') : '音声を準備しています'}</p></div>
          <button className="play" type="button" disabled={!audioUrl} onClick={togglePlayback}>{playing ? '一時停止' : '再生'}</button>
          <audio ref={audio} src={audioUrl || undefined} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} loop={repeat} />
        </div>
        <div className="seek-control">
          <div className="seek-heading"><label htmlFor="seek">再生位置</label><span>{formatTime(currentTime)} / {formatTime(duration)}</span></div>
          <input id="seek" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={seek} disabled={!audioUrl || !duration} aria-label="再生位置" />
          <div className="seek-actions"><button type="button" className="secondary" onClick={resetPlayback} disabled={!audioUrl}>先頭に戻る</button><label className="repeat"><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} disabled={!audioUrl} /> 全体を繰り返す</label></div>
        </div>
        <div className="speed-control">
          <div className="speed-heading"><label htmlFor="speed">再生速度</label><output htmlFor="speed">{speed.toFixed(1)}倍</output></div>
          <input id="speed" type="range" min="1" max="4" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          <div className="speed-scale" aria-hidden="true"><span>1.0倍</span><span>4.0倍</span></div>
        </div>
        {mode === 'materials' && selectedMaterial && <div className="test-entry"><p className="playback-label">理解度テスト</p><p className="hint">教材を聞いた後、問題に進んで内容を確認できます。</p><button className="secondary" type="button" onClick={startTest} disabled={!audioUrl || stale}>問題に進む</button>{!audioUrl && <p className="hint">先に教材の音声を生成してください。</p>}{stale && <p className="hint">本文を変更したため、再生成してから問題に進んでください。</p>}</div>}
      </section>
      {mode === 'materials' && testStarted && selectedMaterial && <section className="test-panel" aria-labelledby="test-title"><h2 id="test-title">{selectedMaterial.title}の理解度テスト</h2>{testScore === null ? <><p className="hint">各問で一つ選んでください。全問回答すると採点できます。</p><form onSubmit={submitTest}>{selectedMaterial.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.choices.map((choice) => <label className="choice" key={choice.id}><input type="radio" name={question.id} value={choice.id} checked={answers[question.id] === choice.id} onChange={() => answerQuestion(question.id, choice.id)} />{choice.text}</label>)}</fieldset>)}{testError && <p className="error" role="alert">{testError}</p>}<button className="primary" type="submit">回答を確認する</button></form></> : <><p className="score">正答数：{testScore} / {selectedMaterial.questions.length}</p>{selectedMaterial.questions.map((question, index) => { const selected = question.choices.find((choice) => choice.id === answers[question.id]); const correct = question.choices.find((choice) => choice.id === question.answerId); return <article className="result" key={question.id}><h3>{index + 1}. {question.prompt}</h3><p>あなたの回答：{selected?.text}</p><p>正解：{correct?.text}</p><p>{question.explanation}</p></article>})}<button className="secondary" type="button" onClick={retryTest}>もう一度回答する</button></>}</section>}
      {mode === 'materials' && selectedMaterial && <section className="history-panel" aria-labelledby="history-title"><h2 id="history-title">過去の結果</h2><p className="hint">このブラウザに保存した、教材「{selectedMaterial.title}」の結果です。ブラウザデータを消去すると失われます。</p>{storageNotice && <p className="storage-notice" role="status">{storageNotice}</p>}{history.length ? <ul className="history-list">{history.map((record) => <li key={record.completedAt}><span>{formatCompletedAt(record.completedAt)}</span><strong>{record.score} / {record.total}</strong><span>{record.speed.toFixed(1)}倍</span></li>)}</ul> : <p className="hint">まだ記録がありません。</p>}</section>}
      <p className="footnote">初回の音声データ取得量：{size ? `約 ${(size / 1024 / 1024).toFixed(1)} MiB（ファイルの合計）` : '確認できません'}。通信量は圧縮やキャッシュにより異なります。{transferredBytes !== null && ` 今回の音声データ取得時の転送量：約 ${(transferredBytes / 1024 / 1024).toFixed(1)} MiB（ブラウザ計測）。`}</p>
    </main>
  )
}
