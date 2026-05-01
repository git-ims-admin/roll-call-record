=== 点呼記録システム ===
Version: 1.0.0

== インストール手順 ==

1. このフォルダ（tenrec-plugin）をまるごと WordPress の
   wp-content/plugins/ にアップロードする

2. WordPress 管理画面 → プラグイン → 「点呼記録システム」を有効化

3. 有効化すると自動でDBテーブルが作成されます（wp_tenrec_daily, wp_tenrec_execs, wp_tenrec_vehicles）

4. 管理画面の左メニューに「🚛 点呼記録」が表示されます

== 必要環境 ==
- WordPress 5.8 以上
- PHP 8.0 以上
- MySQL 5.7 以上（または MariaDB 10.3 以上）

== フォルダ構成 ==
tenrec-plugin/
├── tenrec-plugin.php   ← メインファイル（DB・REST API・管理画面）
├── assets/
│   ├── app.js          ← フロントエンドJS（REST API通信）
│   └── style.css       ← スタイルシート
└── README.txt          ← このファイル

== REST API エンドポイント ==
認証: ログイン必須 + WordPress Nonce

GET    /wp-json/tenrec/v1/daily?from=YYYYMMDD&to=YYYYMMDD  → 期間の日次記録取得
GET    /wp-json/tenrec/v1/daily/{ymd}                       → 特定日の記録取得
POST   /wp-json/tenrec/v1/daily                             → 日次記録保存
DELETE /wp-json/tenrec/v1/daily/{ymd}                       → 特定日の記録削除

GET    /wp-json/tenrec/v1/execs      → 執行者マスタ取得
POST   /wp-json/tenrec/v1/execs      → 執行者追加
DELETE /wp-json/tenrec/v1/execs/{id} → 執行者削除

GET    /wp-json/tenrec/v1/vehicles          → 車両マスタ取得
POST   /wp-json/tenrec/v1/vehicles          → 車両追加
PUT    /wp-json/tenrec/v1/vehicles/{id}     → 車両更新
DELETE /wp-json/tenrec/v1/vehicles/{id}     → 車両削除
POST   /wp-json/tenrec/v1/vehicles/bulk     → 車両一括登録（CSV取込用）

== データ移行（既存HTMLのlocalStorageから） ==
ブラウザのコンソールで以下を実行してJSONをコピー：
  JSON.stringify({
    daily:    JSON.parse(localStorage.getItem('tenrec_daily')||'{}'),
    execs:    JSON.parse(localStorage.getItem('tenrec_execs')||'[]'),
    vehicles: JSON.parse(localStorage.getItem('tenrec_vehicles')||'[]')
  })

その後、WP管理画面の点呼記録システムで各マスタを手動で再登録してください。
