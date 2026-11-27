# Factory Game

**Factory Game** は、ブラウザ上で動作する 2D ドット絵（32×32）・完全タイルグリッド型の工場自動化シミュレーションゲームです。プレイヤーによる手動構築と、**WebMCP（`document.modelContext`）** を通じた AI エージェントによる自律構築・最適化が完全対称の操作系で協働します。

- **公開 URL（GitHub Pages）**: https://likr-sandbox.github.io/factory-game/
- **設計仕様**: [docs/design.md](./docs/design.md)

## 主な特徴

- **完全タイルグリッド × 実物質生産チェーン**: 鉄鉱石・銅鉱石・石炭・珪砂を採掘し、ベルトコンベア（N/E/S/W 向き指定）・分配機・精錬炉・組立機・不純物処理炉・センサーを組み合わせて鉄板・銅板・歯車・銅線・鋼板・シリコンウェファー・電子基板・マイクロチップ・自動化モジュールを生産。スラグ（不純物）副産物処理とフィルター選別を実装。
- **32×32 コード生成ドット絵 × Phaser 3**: `pixelArt: true` による鮮明なドット絵タイルと稼働アニメーション。
- **WebMCP（`document.modelContext` / フォールバック `navigator.modelContext`）専用対称ツール**: プレイヤー操作と同一の権限・検証ルールを持つツール群をブラウザへ公開し、外部 AI エージェントが工場のスキャン・一括配線・レシピ設定・異常診断・技術アンロックを実行可能（`window.ai` / 外部 API キー設定は不要・非対応）。
- **段階的信頼性工学**: 有限鉱脈の枯渇、過負荷故障と復旧、高効率・不純物（スラグ）副産物レシピとフィルター選別、再帰的精製ループを段階導入。
- **進行システム**: チュートリアル Phase 1〜4、テックツリー研究アンロック、動的納品クエスト、研究ポイント（SPM 計測連動）。

## 操作方法

### 基本操作（HUD パネル経由）

- **速度変更**: 一時停止 / 1x / 2x / 4x ボタンで simulation speed を制御
- **テックツリー研究アンロック**: HUD 右側の「アンロック」ボタンから以下の技術を取得可能
  - 地下ベルト（交差ブリッジ）
  - フィルター分配機
  - センサー（流量・異常監視）
  - 不純物処理炉（リサイクラー）
  - 組立機
  - 高度精錬技術（鋼板・シリコンウェファー）
  - 電子工業（電子基板・マイクロチップ・自動化モジュール）
  - 自動化研究
- **ワールドリセット（シード値）**: シード値入力欄に任意の数値を入力して「リセット」、または「ランダム」で自動生成
  - シード値指定により鉱脈配置・初期資源分布を再現可能

### ハウダークontrol（palette bar）

- **建物配置モード**: 左側パレットから建物を選択（採掘ドリル / ベルト / 分配機 / 溶鉱炉 / 組立機 / 不純物処理炉 / センサー / ハブ）
- **方向回転**: 「回転」ボタンで N → E → S → W 順に時計回りに切り替え
- **撤去モード**: 「撤去」ボタンで選択した建物を解体（資材返却）
- **インスペクトモード**: 「インスペクト」ボタンで tile 詳細表示・レシピ変更・修理機能活性化

### 進行ループ

#### チュートリアル Phase 1〜4

1. **Phase 1（手動構築基礎）**: 手動採掘・手動製錬・鉄板 10 個／銅板 10 個納品
2. **Phase 2（並列化・バッチ建設）**: 採掘ドリル 4 基＋溶鉱炉 2 基設置、安定生産ライン構築、地下ベルト活用
3. **Phase 3（電子工業拡張）**: 電子工業技術アンロック、組立機による電子基板ライン、フィルター分配機選別、銅線 20 個＋電子基板 5 個納品
4. **Phase 4（高度技術・完全自動化）**: 高度精錬・自動化研究アンロック、不純物処理炉によるスラグ処理、センサー監視、マイクロチップ 10 個＋自動化モジュール 3 個納品

#### テックツリー

- 研究ポイント（RP）で技術アンロック：各製品納品で RP 付与（鉄板 5pt / 銅板 5pt / 歯車 8pt / 銅線 8pt / 鋼板 12pt / シリコンウェファー 12pt / 電子基板 15pt / マイクロチップ 20pt / 自動化モジュール 25pt / スラグ 2pt）
- 技術ごとにコスト設定（地下ベルト 150pt / フィルター分配機 100pt / 高速効率 200pt / センサー 150pt / リサイクラー 200pt / 高度精錬 200pt / 電子工業 300pt / 自動化 500pt）

#### 動的納品クエスト

- 最大 3 つのクエスト同時アクティブ
- 鉄板 15 / 銅板 15 / 鉄歯車 8 / 銅線 12 / 電子基板 5 / マイクロチップ 3 / 自動化モジュール 2 のいずれかを目標とした納品ミッション
- クエスト完了で研究ポイント報酬（50〜250pt）
- 有効時間 6000 タイク（約 100 分）

#### SPM 計測

- HUD 左側に「生産速度/分」（SPM: Items Per Minute）表示
- 各製品の納入数も個別カウント（鉄板・銅板・鉄ギア・銅線）
- タイク進行状況もリアルタイム表示

## WebMCP ツール群

WebMCP 対応ブラウザ環境（Chrome Origin Trial 参加または `chrome://flags/#enable-webmcp-testing` 有効化環境）では、ページ起動時に以下のツールが `document.modelContext`（フォールバック `navigator.modelContext`）へ自動登録されます。画面右側の WebMCP パネルから接続状態と呼び出しログを確認できます。

### 読み取りツール（Read Tools）

- **`get_factory_summary`**: 現在の工場状態（建物・資源・生産指標）を包括的に取得
- **`inspect_region(x, y, width, height)`**: 矩形領域内の地形・建物・資源を返却
- **`find_resources(material?, onlyAvailable?, limit?)`**: 資源埋蔵量を検索（材質フィルタ・枯渇除外・結果制限可能）
- **`list_recipes(onlyUnlocked?)`**: 利用可能なレシピ一覧（アンロック済みフィルタ可能）
- **`get_metrics(windowTicks?)`**: 生産・効率指標（SPM・納入統計）を取得

### 変更ツール（Mutate Tools）

- **`place_building(x, y, type, direction, recipeId?, filterMaterial?)`**: 指定座標に建物配置（方向・レシピ・フィルター設定可能）
- **`place_belt_line(startX, startY, endX, endY, cornerFirst?)`**: 2 点間をベルト線で結ぶ（自動コーナー生成）
- **`remove_area(x, y, width, height)`**: 矩形区域内の全建物を解体（資材返却）
- **`set_recipe(x, y, recipeId?, filterMaterial?, repair?)`**: 建物のレシピ／フィルターを変更、故障時は修理可能
- **`batch_actions(actions[], atomic?)`**: 複数アクションを原子実行（atomic=true で全成功 or 全失敗）
- **`unlock_tech(techId)`**: 研究ポイントを使用して技術をアンロック（`underground_belt` / `filter_splitter` / `high_efficiency` / `sensor` / `recycler` / `advanced_smelting` / `electronics` / `automation`）

非対応環境でも手動プレイ・シミュレーション確認はそのまま動作します。

## 開発・ビルド・検証コマンド

```sh
# 依存関係のインストール
npm install

# 開発サーバー起動（ホットリロード）
npm run dev

# 型チェック・テスト・ビルド実行
npm run verify   # tsc --noEmit && vitest run && vite build

# 単体テスト実行
npm test         # vitest run

# ビルドのみ
npm run build    # vite build
```

### ビルド出力

- ビルド出力先: `dist/` ディレクトリ
- GitHub Pages デプロイ用ベースパス: `/factory-game/`（`vite.config.ts` にて設定済み）

### ブラウザ要件

- WebMCP 機能利用時: Chrome（Origin Trial 参加または `chrome://flags/#enable-webmcp-testing` 有効化）
- 基本プレイ: 現代の任意のモダンブラウザ（ES modules 対応）
