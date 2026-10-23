# 速聴トレーニング

日本語の文章を速い音声で聞き、教材の理解度を確認する Web アプリの開発リポジトリです。現在は開発環境のみを用意しており、音声合成・再生や教材機能は未実装です。

## 動作環境

- Node.js 22.13 以上の 22 系、24 系、または 26 以上
- npm

依存関係のバージョンは `package-lock.json` で固定しています。Node.js 26.8.1 と npm 11.19.0 で確認しています。

## 開発方法

```sh
npm ci
npm run dev
```

表示されたローカル URL をブラウザで開きます。終了は `Ctrl+C` です。

```sh
npm run lint       # ESLint
npm run typecheck  # TypeScript の型検査
npm test           # Vitest（テストがない段階でも成功する）
npm run build      # 型検査と本番ビルド
npm run preview  # ビルド結果をローカルで確認
```

本番ビルドは `dist/` に生成されます。現時点ではテストは用意していません。機能の追加時に対象のテストを作成します。

## 参照資料

- [仕様書](docs/仕様書.md)
- [プロダクトバックログ](docs/プロダクトバックログ.md)
- [技術選定](docs/技術選定.md)

開発基盤は [Vite の React・TypeScript 構成](https://github.com/vitejs/vite/tree/main/packages/create-vite)と [Vitest](https://github.com/vitest-dev/vitest) を参考にしました。Vite は MIT、テンプレートは CC0、Vitest は MIT です。静的配信と React に適した構成と、Vite と共通の設定でテストできる点を採用理由としています。音声エンジンと音声・辞書データは、互換性と配布条件を確認した後に選定します。
