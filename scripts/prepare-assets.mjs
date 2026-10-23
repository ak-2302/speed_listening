import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const assets = join(process.cwd(), 'public/assets')
const temporary = await mkdtemp(join(tmpdir(), 'speed-listening-'))
const files = ['sys.dic', 'matrix.bin', 'char.bin', 'unk.dic', 'left-id.def', 'right-id.def', 'pos-id.def', 'rewrite.def']

async function download(url, hash) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`取得に失敗しました: ${response.status} ${url}`)
  const data = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(data).digest('hex') !== hash) throw new Error(`ハッシュが一致しません: ${url}`)
  return data
}

try {
  console.log('音声合成用の辞書と音声を取得しています。')
  const [dictionary, voice, voiceCopyright] = await Promise.all([
    download('https://github.com/r9y9/open_jtalk/releases/download/v1.11.1/open_jtalk_dic_utf_8-1.11.tar.gz', 'fe6ba0e43542cef98339abdffd903e062008ea170b04e7e2a35da805902f382a'),
    download('https://raw.githubusercontent.com/nvdajp/nvdajp/release-2026.2jp/source/synthDrivers/jtalk/tohokuf01/tohoku-f01-neutral.htsvoice', 'ded6acb4243b93cc50896199d67b00a7c487662bfcdcd3f9f30a4fb0444b0b46'),
    download('https://raw.githubusercontent.com/nvdajp/nvdajp/release-2026.2jp/source/synthDrivers/jtalk/tohokuf01/COPYRIGHT.txt', 'f7f7a1a696f062704825fcc495d330beeeac8c0ed38d8f5bdd8e90bdc3471c95'),
  ])
  const archive = join(temporary, 'dictionary.tar.gz')
  await writeFile(archive, dictionary)
  execFileSync('tar', ['-xzf', archive, '-C', temporary])
  await mkdir(join(assets, 'dic'), { recursive: true })
  await mkdir(join(assets, 'runtime'), { recursive: true })
  await mkdir(join(assets, 'licenses'), { recursive: true })
  for (const file of files) await cp(join(temporary, 'open_jtalk_dic_utf_8-1.11', file), join(assets, 'dic', file))
  await cp(join(temporary, 'open_jtalk_dic_utf_8-1.11', 'COPYING'), join(assets, 'dic', 'COPYING'))
  await writeFile(join(assets, 'tohoku-f01-neutral.htsvoice'), voice)
  await writeFile(join(assets, 'licenses', 'tohoku-f01-COPYRIGHT.txt'), voiceCopyright)
  const runtime = join(process.cwd(), 'node_modules/@keanu-thakalath/openjtalkjs/dist')
  for (const file of ['openjtalk-wasm-wrapper-D6E3BSJO.js', 'openjtalk-wasm.wasm']) await cp(join(runtime, file), join(assets, 'runtime', file))
  const packageRoot = join(process.cwd(), 'node_modules/@keanu-thakalath/openjtalkjs')
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) await cp(join(packageRoot, file), join(assets, 'licenses', `openjtalkjs-${file}`))
  const sizes = await Promise.all([...files.map((file) => readFile(join(assets, 'dic', file))), readFile(join(assets, 'tohoku-f01-neutral.htsvoice')), readFile(join(assets, 'runtime', 'openjtalk-wasm.wasm')), readFile(join(assets, 'runtime', 'openjtalk-wasm-wrapper-D6E3BSJO.js'))])
  const bytes = sizes.reduce((sum, file) => sum + file.length, 0)
  await writeFile(join(assets, 'size.json'), JSON.stringify({ bytes }))
  console.log(`準備が完了しました。合成用ファイルの合計: ${bytes} バイト`)
} catch (error) {
  console.error('準備に失敗しました。ネットワーク接続と依存関係を確認して再実行してください。', error)
  process.exitCode = 1
} finally {
  await rm(temporary, { recursive: true, force: true })
}
