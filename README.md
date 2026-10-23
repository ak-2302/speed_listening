# 速聴トレーニング

日本語の文章を音声で聞く練習用 Web アプリです。現在は自分の文章の音声生成と再生を開発中です。速度変更、教材、問題、記録は未実装です。

## 動作環境

- 開発：Node.js 22.13 以上の 22 系、24 系、または 26 以上、npm、`tar`、インターネット接続
- 利用：WebAssembly、Web Worker、音声再生に対応したブラウザ。実機の対応範囲は検証中です。

依存関係のバージョンは `package-lock.json` で固定しています。

## 開発方法

```sh
npm ci --ignore-scripts
npm run prepare:assets
npm run dev
```

`--ignore-scripts` は音声合成パッケージが別の音声と辞書を自動取得する処理を避けるために指定します。`prepare:assets` は指定した辞書と音声を取得し、SHA-256 を照合して `public/assets/` に展開します。このフォルダは Git に含めません。初回の辞書・音声取得にはネットワークが必要です。

表示されたローカル URL をブラウザで開き、文章を入力して「音声を生成する」を押します。生成後に「再生」を押すと聞けます。生成はブラウザ内で行い、入力した文章を保存しません。最大 100 文字は暫定値です。文章が長いと分割して生成するため、文の区切りや読みが変わる場合があります。

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` の前に `npm run prepare:assets` が必要です。本番ビルドは `dist/` に生成されます。

## 音声と配布条件

- 音声は [NVDA 日本語版 2026.2jp の tohoku-f01-neutral.htsvoice](https://github.com/nvdajp/nvdajp/tree/release-2026.2jp/source/synthDrivers/jtalk/tohokuf01) を使用します。Copyright 2015 東北大学 Intelligent Communication Network (Ito-Nose) Laboratory、[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。音声ファイルは変更していません。
- 辞書は [Open JTalk UTF-8 辞書 1.11](https://github.com/r9y9/open_jtalk/releases/tag/v1.11.1)、音声合成は [openjtalkjs 0.1.0](https://github.com/keanu-thakalath/openjtalkjs) の WebAssembly 版を利用します。辞書の `COPYING` は準備時に取得されます。
- 音声ライブラリの配布物に含まれる第三者コンポーネントの権利表示・ソース提供条件、実際の配布方法は確認中です。**確認が完了するまで一般公開しないでください。** NVDA との実聴比較も未実施です。詳細は [ライセンス調査](docs/ライセンス調査.md) と [問題の記録](ISSUE.md) を参照してください。

## 参照資料

- [仕様書](docs/仕様書.md)
- [プロダクトバックログ](docs/プロダクトバックログ.md)
- [技術選定](docs/技術選定.md)
- [PBI-01 デザインブリーフ](docs/デザインブリーフ.md)

開発基盤は [Vite の React・TypeScript 構成](https://github.com/vitejs/vite/tree/main/packages/create-vite) と [Vitest](https://github.com/vitest-dev/vitest) を参考にしました。Vite は MIT、テンプレートは CC0、Vitest は MIT です。静的配信と React に適した構成と、Vite と共通の設定でテストできる点を採用理由としています。
