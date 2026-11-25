# Agentcraft 設計仕様書 (`docs/design.md`)

> 「君の言葉が、万の歯車を回す」 — WebMCP × 2Dドット絵 × 実物質工場自動化シミュレーション

## 1. コンセプトと基本方針

- **タイトル**: **Agentcraft**
- **ジャンル**: ブラウザ動作・2D ドット絵・完全タイルグリッド型工場自動化シミュレーション × WebMCP 協働ゲーム
- **UI 表示言語**: **日本語 UI**（施設名・物質名・HUD・チュートリアル・操作ガイドは日本語で統一。WebMCP のツール名・JSON Schema・返却ペイロードは AI エージェント精度のため **英語** とする）
- **AI 連携方式**: **WebMCP（`document.modelContext` / 旧 `navigator.modelContext` フォールバック）のみ**
  - `window.ai` / `LanguageModel`（Prompt API）および BYOK（外部 LLM API キー設定UI・サーバー通信）は**実装しない**。
  - 静的サイト（GitHub Pages）上で完結し、外部のブラウザ AI エージェントへ対称な構造化ツールを公開する。

---

## 2. 技術スタックとリポジトリ構成

| 項目 | 選定技術 |
| :--- | :--- |
| ビルド / 言語 | Vite + TypeScript（`strict: true`, `noUncheckedIndexedAccess: true`） |
| 2D ゲームエンジン | Phaser 3（`pixelArt: true`, `roundPixels: true`, `antialias: false`） |
| テスト | Vitest（非対話単発実行 `vitest run`） |
| デプロイ | GitHub Pages（Vite `base: '/factory-game/'` + `.github/workflows/deploy-pages.yml`） |

### アーキテクチャ境界（関心の厳密分離）

Phaser やブラウザ DOM に依存せずにシミュレーションと WebMCP ハンドラを高速・決定論的に検証するため、以下の 4 層へ分離する。

```text
src/
├── sim/        # 純 TypeScript ヘッドレスシミュレーション（DOM / Phaser 完全非依存）
│   ├── types.ts        # Direction, MaterialId, BuildingType, RecipeId, Tile, BuildingState, WorldState
│   ├── catalog.ts      # 実物質・施設コスト/処理時間・レシピ・テックツリー・クエスト定義
│   ├── world.ts        # シード付き 64x64 タイルマップ生成（鉄/銅/石炭/珪砂の有限鉱床配置）
│   ├── engine.ts       # 固定ティック更新（採掘・ベルト搬送・分配/フィルター・加工・故障/劣化・SPM計測）
│   ├── actions.ts      # プレイヤーと WebMCP で完全共通の対称コマンド実行エンジン + 構造化エラー返却
│   └── query.ts        # getFactorySummary, inspectRegion, findResources, listRecipes, getMetrics
├── webmcp/     # Phaser 非依存の WebMCP ツール登録・スキーマ・実行ログ記録層
│   ├── types.ts        # WebMCP 型定義（document.modelContext / navigator.modelContext 互換）
│   ├── schemas.ts      # 全 10 ツールの JSON Schema 定義
│   └── bridge.ts       # feature detection 登録・呼び出しフック・リングバッファログ管理
├── game/       # Phaser 3 描画・カメラ・32x32 ドット絵生成層
│   ├── palette.ts      # 共通カラーパレット & 32x32 スプライトピクセル配列定義
│   ├── textures.ts     # Phaser CanvasTexture への 32x32 ドット絵一括生成（4方向回転・稼働フレーム）
│   └── FactoryScene.ts # タイルマップ描画、ベルト上の物質移動アニメ、故障/枯渇オーバーレイ、マウス操作
└── ui/         # 日本語 HUD（HTML/CSS オーバーレイ）
    ├── hud.ts          # 上部ステータス（SPM / 電力・稼働率 / クエスト / テック / 速度切替）
    ├── paletteBar.ts   # 下部建築パレット（回転 R / 解体 X / 範囲選択 / レシピ選択）
    └── webmcpPanel.ts  # 折りたたみ可能な WebMCP 接続状態 & リアルタイムツール呼び出しログパネル
```

### 必須検証コマンド契約（`package.json`）

- `"verify": "tsc --noEmit && vitest run && vite build"`
- `"test": "vitest run"`
- `"build": "vite build"`

---

## 3. 空間モデルと施設・物質仕様

### 3.1 完全タイルグリッド（64×64）
- 座標系: `(x, y)` (`0 <= x < 64`, `0 <= y < 64`)。
- 向き（`Direction`）: `"N" | "E" | "S" | "W"`。すべての施設・コンベアベルトは 1 マス単位で向きを持つ。
- 各タイルは地形（`grass`, `rock`, `water` 等の障害地形、および資源鉱床 `ResourceDeposit { material, remaining }`）と、最大 1 つの設置物（`Building`）を持つ。
- **ベルト搬送**:
  - 各コンベアベルトは入力方向（側面・背面から受け入れ）と出力方向（正面 `direction` の 1 マス先へ搬送）を持ち、バッファ容量内の実物質アイテムをティックごとに前進させる。
  - **分配機 (`splitter`)**: 正面入力または側面入力から受けた物質を、接続先のある出力辺へラウンドロビンで均等分配する。
  - **フィルター分配機 (`filter_splitter`)**: 指定物質 `filterMaterial` のみを正面へ流し、それ以外（スラグ等の不純物や別種物質）を左右側面の空き出力辺へ振り分ける。
  - **地下コンベア / 高帯域ブリッジ (`underground_in` / `underground_out`)**: 最大 4 マスまでの直線交差を跨いで高速搬送する（テックアンロック対象）。

### 3.2 実物質カタログ（金属精錬＆電子工業）

| ID | 日本語名 | 区分 | 入手・用途 |
| :--- | :--- | :--- | :--- |
| `iron_ore` | 鉄鉱石 | 原鉱 | 鉱脈から採掘 |
| `copper_ore` | 銅鉱石 | 原鉱 | 鉱脈から採掘 |
| `coal` | 石炭 | 原鉱・燃料 | 鉱脈から採掘／炉燃料・鋼鉄原料 |
| `silica_sand` | 珪砂 | 原鉱 | 鉱脈から採掘／シリコンウェハ原料 |
| `iron_plate` | 鉄板 | 中間材 | 鉄鉱石の精錬 |
| `copper_plate` | 銅板 | 中間材 | 銅鉱石の精錬 |
| `iron_gear` | 鉄歯車 | 部品 | 鉄板×2 → 鉄歯車×1 |
| `copper_wire` | 銅線 | 部品 | 銅板×1 → 銅線×2 |
| `steel_plate` | 鋼板 | 中間材 | 鉄板×2 + 石炭×1 → 鋼板×1 |
| `silicon_wafer` | シリコンウェハ | 中間材 | 珪砂×2 + 石炭×1 → シリコンウェハ×1 |
| `circuit_board` | 電子基板 | 電子部品 | 鉄板×1 + 銅線×3 → 電子基板×1 |
| `microchip` | マイクロチップ | 高度部品 | 電子基板×1 + シリコンウェハ×2 + 銅線×2 → マイクロチップ×1 |
| `automation_module` | 自動化モジュール | 最終研究品 | 鋼板×2 + 鉄歯車×4 + マイクロチップ×2 → 自動化モジュール×1 |
| `slag` | スラグ（不純物） | 副産物 | 高効率レシピで確率排出。詰まり防止にフィルター分離または処理炉で回収が必要 |

### 3.3 施設カタログ

| BuildingType | 日本語名 | 役割 |
| :--- | :--- | :--- |
| `miner` | 採掘ドリル | 資源鉱床上に設置し、正面方向へ原鉱を排出（鉱脈残量を消費） |
| `belt` | コンベアベルト | 1 マス単位でアイテムを `direction` 先へ搬送 |
| `splitter` | 分配機 | 入力を複数出力先へ均等分配（ロードバランス） |
| `filter_splitter` | フィルター分配機 | 指定物質とその他（スラグ等）を方向別に選別 |
| `underground_belt` | 交差ブリッジ | 他のラインを飛び越えて直線長距離輸送（テック解放） |
| `smelter` | 溶鉱炉 | 原鉱の精錬・鋼鉄/ウェハ製造（レシピ指定可能） |
| `assembler` | 組立機 | 歯車・銅線・基板・マイクロチップ・モジュールの加工（レシピ指定可能） |
| `recycler` | 不純物処理炉 | スラグや不良品を資源へ再還元・無害化する精製ループ用施設 |
| `sensor` | 流量・異常センサー | 周囲/接続先の詰まり・過負荷・枯渇イベントを記録（テック解放） |
| `hub` | 中枢納品ハブ | マップ中央に配置（2×2 占有または中枢コア周囲 4 方向搬入）。納品された物質から SPM・クエスト進捗・研究ポイントを計上 |

### 3.4 段階的信頼性工学とプログレッション

1. **鉱床枯渇（有限資源）**: 各鉱脈は有限残量（例: 500〜2,500）を持ち、0 になると採掘が停止し枯渇フラグが立つ。エージェントは `find_resources` で代替鉱脈を検索し新規採掘ラインを接続する。
2. **過負荷劣化と故障停止**: 連続高稼働または出力詰まり状態で負荷ゲージが溜まると低確率で `faulted` 停止を起こす（リペア操作またはバイパス並列ライン構築で稼働率を維持）。
3. **高効率＆不純物レシピ・精製ループ**: 上位または高効率レシピ（例: 高速精錬・濃化シリコン精製）は高スループットと引き換えに一定確率で `slag` を副産物として排出。フィルター分配機＋不純物処理炉による循環精製ラインを組まないと出力が詰まる。
4. **チュートリアル Phase 1〜4 & テックツリー & 動的納品クエスト**:
   - **Phase 1**: 鉄鉱石の手動採掘・ベルト・溶鉱炉・ハブ納品
   - **Phase 2**: AI エージェント（WebMCP）連携による一括採掘ライン敷設
   - **Phase 3**: 並列化＆分配機でのボトルネック解消（電子基板ライン）
   - **Phase 4**: 鉱脈枯渇・スラグ排出・故障停止からの迂回・自己修復対応
   - **テックツリー**: 交差ブリッジ、フィルター強化、高効率精錬、センサー監視、高度電子部品を研究ポイントで段階解放。
   - **エンドコンテンツ**: 目標 SPM（Science / Modules Per Minute）計測、時限の動的納品クエスト、同一マップシード再現性。

---

## 4. 32×32 ドット絵グラフィック仕様

- 外部画像ファイルに依存せず、`src/game/palette.ts` + `src/game/textures.ts` で 32×32 ピクセルアートをプログラム生成する。
- 施設・ベルト・鉱床・各実物質アイテム（鉄鉱石の銀灰粒、銅鉱石の赤銅塊、石炭の黒結晶、珪砂の淡黄粒、各金属板・歯車・緑基板・ICチップ等）を明確に識別可能なドット絵として描画する。
- 4 方向（N/E/S/W）の向き矢印・アニメーション（ベルトの縞スクロール、ドリルの回転刃、溶鉱炉の炎点滅、故障時の赤警告ランプ点滅）をテクスチャフレームまたは描画レイヤーで表現する。

---

## 5. WebMCP 公開ツール仕様（完全対称操作）

ページ読み込み時、`const modelContext = document.modelContext ?? navigator.modelContext;` を検出し（未存在時は安全にスキップし、HUD 上で「WebMCP 未検出（手動プレイモード）」と案内）、以下のツールを `registerTool` で登録する。全ミューテーションは `src/sim/actions.ts` を通り、手動 UI と同一のバリデーション・コスト/配置制約・エラー返却を行う。

### 読み取り・監査ツール（Read / Inspect）
1. `get_factory_summary`: マップサイズ、ハブ位置・納品累計、現在の SPM、フェーズ/チュートリアル進捗、アクティブクエスト、稼働/故障/枯渇カウント、総施設数。
2. `inspect_region`: `{ x, y, width, height }` 内の地形・鉱床残量・設置施設・向き・レシピ・積載アイテム・エラー状態を軽量 JSON で返す（幅・高さ上限ありでコンテキスト肥大を防止）。
3. `find_resources`: `{ material?, onlyAvailable?, limit? }` により未枯渇の鉱床座標・残量・ハブからの距離をソートして返す。
4. `list_recipes`: 全レシピ（またはアンロック済みレシピ）の入力・出力・処理ティック・スラグ確率・対象施設・テックアンロック状況を返す。
5. `get_metrics`: 直近 60 秒間の物質別生産/納品レート（per min）、ボトルネック候補（入力待ち・出力詰まり施設リスト）、故障・枯渇アラート一覧を返す。

### 構築・変更ツール（Mutate — 手動 UI と完全対称）
6. `place_building`: `{ x, y, type, direction, recipeId?, filterMaterial? }` — 単マス施設配置・向き指定（ハブ以外の全施設）。配置不可（範囲外、既存施設、鉱脈以外のドリル設置等）は構造化エラー理由を返す。
7. `place_belt_line`: `{ startX, startY, endX, endY, cornerFirst?: "x" | "y" }` — 2 座標間をマンハッタン L 字または直線で `belt` を自動向き設定しながら一括敷設（既存施設に衝突時は変更をロールバックして衝突座標を返す）。
8. `remove_area`: `{ x, y, width, height }` — 指定矩形内の施設・ベルトを解体撤去（ハブは保護）。
9. `set_recipe`: `{ x, y, recipeId?, filterMaterial?, repair?: boolean }` — 既存施設（溶鉱炉/組立機/フィルター分配機）の設定変更または故障施設の修理。
10. `batch_actions`: `{ actions: Array<PlaceBuilding | PlaceBeltLine | RemoveArea | SetRecipe>, atomic?: boolean }` — 複数操作を 1 回のツール呼び出しで一括実行（`atomic: true` 時は 1 つでも検証失敗したら全体をロールバックし、失敗インデックスと理由を返してエージェントの自己修正を促す）。

---

## 6. GitHub Pages 公開要件

- `vite.config.ts` で `base: '/factory-game/'` を設定。
- `.github/workflows/deploy-pages.yml` を配置し、`main` ブランチへのプッシュ時に `npm ci` → `npm run verify` → `actions/upload-pages-artifact` → `actions/deploy-pages` を自動実行して GitHub Pages へデプロイする。
