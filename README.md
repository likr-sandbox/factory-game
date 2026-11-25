# Agentcraft

**Agentcraft** は、ブラウザ上で動作する 2D ドット絵（32×32）・完全タイルグリッド型の工場自動化シミュレーションゲームです。プレイヤーによる手動構築と、**WebMCP（`document.modelContext`）** を通じた AI エージェントによる自律構築・最適化が完全対称の操作系で協働します。

- **公開 URL（GitHub Pages）**: https://likr-sandbox.github.io/factory-game/
- **設計仕様**: [docs/design.md](./docs/design.md)

## 主な特徴

- **完全タイルグリッド × 実物質生産チェーン**: 鉄鉱石・銅鉱石・石炭・珪砂を採掘し、ベルトコンベア（N/E/S/W 向き指定）・分配機・精錬炉・組立機を組み合わせて金属板・歯車・銅線・電子基板・マイクロチップ・自動化モジュールを生産。
- **32×32 コード生成ドット絵 × Phaser 3**: `pixelArt: true` による鮮明なドット絵タイルと稼働アニメーション。
- **WebMCP（`document.modelContext`）専用対称ツール**: プレイヤー操作と同一の権限・検証ルールを持つツール群をブラウザへ公開し、外部 AI エージェントが工場のスキャン・一括配線・レシピ設定・異常診断を実行可能（`window.ai` / 外部 API キー設定は不要・非対応）。
- **段階的信頼性工学**: 有限鉱脈の枯渇、過負荷故障と復旧、高効率・不純物（スラグ）副産物レシピとフィルター選別、再帰的精製ループを段階導入。

## 開発・検証コマンド（Milestone 1 構築後）

```sh
npm install
npm run dev
npm run verify   # tsc --noEmit && vitest run && vite build
```

## WebMCP の利用環境について

WebMCP（`document.modelContext` / フォールバック `navigator.modelContext`）対応ブラウザ環境（Chrome Origin Trial 参加または `chrome://flags/#enable-webmcp-testing` 有効化環境）では、ページ起動時に工場操作ツールが自動登録され、画面右側の HUD パネルから接続状態と呼び出しログを確認できます。非対応環境でも手動プレイ・シミュレーション確認はそのまま動作します。
