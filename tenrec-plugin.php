<?php
/**
 * Plugin Name: 点呼記録システム
 * Description: 運送業向け点呼記録・日常点検管理システム
 * Version: 1.0.0
 * Author: Your Company
 * Text Domain: tenrec
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'TENREC_VERSION', '1.0.0' );
define( 'TENREC_DIR', plugin_dir_path( __FILE__ ) );
define( 'TENREC_URL', plugin_dir_url( __FILE__ ) );

// ============================================================
// 有効化時: テーブル作成
// ============================================================
register_activation_hook( __FILE__, 'tenrec_activate' );
function tenrec_activate() {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();

    // 日次記録テーブル
    $sql1 = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}tenrec_daily (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        ymd CHAR(8) NOT NULL COMMENT 'YYYYMMDD',
        supervisor VARCHAR(100) DEFAULT '',
        manager VARCHAR(100) DEFAULT '',
        manager2 VARCHAR(100) DEFAULT '',
        helper VARCHAR(100) DEFAULT '',
        helper2 VARCHAR(100) DEFAULT '',
        entries LONGTEXT NOT NULL DEFAULT '[]' COMMENT 'JSON array of entry objects',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY ymd (ymd)
    ) $charset;";

    // 執行者マスタ
    $sql2 = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}tenrec_execs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        day_type VARCHAR(20) DEFAULT '全日',
        start_time VARCHAR(5) DEFAULT '',
        end_time VARCHAR(5) DEFAULT '',
        sort_order INT DEFAULT 0,
        PRIMARY KEY (id)
    ) $charset;";

    // 車両マスタ
    $sql3 = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}tenrec_vehicles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        seq VARCHAR(20) DEFAULT '',
        bureau VARCHAR(50) DEFAULT '',
        class_no VARCHAR(20) DEFAULT '',
        usage_type VARCHAR(20) DEFAULT '',
        num VARCHAR(20) DEFAULT '',
        vehicle_type VARCHAR(50) DEFAULT '',
        driver VARCHAR(100) DEFAULT '',
        tel VARCHAR(30) DEFAULT '',
        sort_order INT DEFAULT 0,
        PRIMARY KEY (id)
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql1 );
    dbDelta( $sql2 );
    dbDelta( $sql3 );

    // 既存テーブルへのカラム追加マイグレーション（dbDeltaが検出できない場合に備えて）
    $cols = $wpdb->get_col( "SHOW COLUMNS FROM {$wpdb->prefix}tenrec_daily", 0 );
    if ( ! in_array( 'supervisor', $cols ) ) {
        $wpdb->query( "ALTER TABLE {$wpdb->prefix}tenrec_daily ADD COLUMN supervisor VARCHAR(100) DEFAULT '' AFTER ymd" );
    }
    if ( ! in_array( 'manager2', $cols ) ) {
        $wpdb->query( "ALTER TABLE {$wpdb->prefix}tenrec_daily ADD COLUMN manager2 VARCHAR(100) DEFAULT '' AFTER manager" );
    }
    if ( ! in_array( 'helper2', $cols ) ) {
        $wpdb->query( "ALTER TABLE {$wpdb->prefix}tenrec_daily ADD COLUMN helper2 VARCHAR(100) DEFAULT '' AFTER helper" );
    }

    update_option( 'tenrec_db_version', TENREC_VERSION );
}

// ============================================================
// 管理画面メニュー登録
// ============================================================
add_action( 'admin_menu', 'tenrec_admin_menu' );
function tenrec_admin_menu() {
    add_menu_page(
        '点呼記録システム',
        '🚛 点呼記録',
        'read',                         // ログインユーザーなら誰でも閲覧可
        'tenrec',
        'tenrec_render_page',
        'dashicons-clipboard',
        30
    );
}

// ============================================================
// 管理画面ページ出力
// ============================================================
function tenrec_render_page() {
    // nonceをJS側に渡す（wp_rest nonce を使用することでREST APIの標準認証に対応）
    $nonce = wp_create_nonce( 'wp_rest' );
    $rest_url = esc_url( rest_url( 'tenrec/v1/' ) );
    ?>
    <div id="tenrec-app-root">
        <!-- アプリがここに挿入される -->
    </div>
    <script>
        window.TENREC_CONFIG = {
            restUrl: <?php echo json_encode( $rest_url ); ?>,
            nonce:   <?php echo json_encode( $nonce ); ?>,
            useDB:   true
        };
    </script>
    <?php
}

// ============================================================
// admin側でスクリプト・スタイルを読み込む
// ============================================================
add_action( 'admin_enqueue_scripts', 'tenrec_enqueue_assets' );
function tenrec_enqueue_assets( $hook ) {
    // 点呼記録のページのみ読み込む
    if ( strpos( $hook, 'tenrec' ) === false ) return;

    wp_enqueue_style(
        'tenrec-style',
        TENREC_URL . 'assets/style.css',
        [],
        TENREC_VERSION
    );
    wp_enqueue_script(
        'tenrec-app',
        TENREC_URL . 'assets/app.js',
        [],
        TENREC_VERSION,
        true  // footer
    );
}

// ============================================================
// WP Admin の余分なスタイルを無効化（全画面アプリのため）
// ============================================================
add_action( 'admin_head', 'tenrec_admin_head' );
function tenrec_admin_head() {
    $screen = get_current_screen();
    if ( ! $screen || strpos( $screen->id, 'tenrec' ) === false ) return;
    ?>
    <style>
        /* WP管理画面のコンテンツ領域をリセット */
        #wpcontent { padding-left: 0 !important; }
        #wpbody-content { padding-bottom: 0 !important; }
        .wrap { margin: 0 !important; padding: 0 !important; }
        #tenrec-app-root { margin: 0; padding: 0; }
        /* 管理バーがある場合は上部を詰める */
        body.admin-bar #wpcontent { margin-top: 0 !important; }
        body.admin-bar #tenrec-app-root { padding-top: 0 !important; }
        /* WPフッターを非表示 */
        #wpfooter { display: none !important; }
        #wpcontent { padding-bottom: 0 !important; }
    </style>
    <?php
}

// プラグインページではWPフッターテキストを空にする
add_filter( 'admin_footer_text', 'tenrec_footer_text' );
function tenrec_footer_text( $text ) {
    $screen = get_current_screen();
    if ( $screen && strpos( $screen->id, 'tenrec' ) !== false ) return '';
    return $text;
}
add_filter( 'update_footer', 'tenrec_update_footer', 99 );
function tenrec_update_footer( $text ) {
    $screen = get_current_screen();
    if ( $screen && strpos( $screen->id, 'tenrec' ) !== false ) return '';
    return $text;
}

// ============================================================
// REST API エンドポイント登録
// ============================================================
add_action( 'rest_api_init', 'tenrec_register_routes' );
function tenrec_register_routes() {
    $ns = 'tenrec/v1';

    // --- 日次記録 ---
    register_rest_route( $ns, '/daily', [
        [ 'methods' => 'GET',  'callback' => 'tenrec_get_daily',    'permission_callback' => 'tenrec_permission' ],
        [ 'methods' => 'POST', 'callback' => 'tenrec_save_daily',   'permission_callback' => 'tenrec_permission' ],
    ]);
    register_rest_route( $ns, '/daily/(?P<ymd>[0-9]{8})', [
        [ 'methods' => 'GET',    'callback' => 'tenrec_get_daily_one', 'permission_callback' => 'tenrec_permission' ],
        [ 'methods' => 'DELETE', 'callback' => 'tenrec_del_daily',     'permission_callback' => 'tenrec_permission' ],
    ]);

    // --- 執行者マスタ ---
    register_rest_route( $ns, '/execs', [
        [ 'methods' => 'GET',  'callback' => 'tenrec_get_execs',  'permission_callback' => 'tenrec_permission' ],
        [ 'methods' => 'POST', 'callback' => 'tenrec_save_exec',  'permission_callback' => 'tenrec_permission' ],
    ]);
    register_rest_route( $ns, '/execs/(?P<id>[0-9]+)', [
        [ 'methods' => 'DELETE', 'callback' => 'tenrec_del_exec', 'permission_callback' => 'tenrec_permission' ],
    ]);

    // --- 車両マスタ ---
    register_rest_route( $ns, '/vehicles', [
        [ 'methods' => 'GET',  'callback' => 'tenrec_get_vehicles',  'permission_callback' => 'tenrec_permission' ],
        [ 'methods' => 'POST', 'callback' => 'tenrec_save_vehicle',  'permission_callback' => 'tenrec_permission' ],
    ]);
    register_rest_route( $ns, '/vehicles/(?P<id>[0-9]+)', [
        [ 'methods' => 'PUT',    'callback' => 'tenrec_update_vehicle', 'permission_callback' => 'tenrec_permission' ],
        [ 'methods' => 'DELETE', 'callback' => 'tenrec_del_vehicle',    'permission_callback' => 'tenrec_permission' ],
    ]);

    // --- 車両一括登録 ---
    register_rest_route( $ns, '/vehicles/bulk', [
        [ 'methods' => 'POST', 'callback' => 'tenrec_bulk_vehicles', 'permission_callback' => 'tenrec_permission' ],
    ]);
}

// パーミッション: ログイン必須 + wp_rest nonceチェック
function tenrec_permission( WP_REST_Request $req ) {
    if ( ! is_user_logged_in() ) {
        return new WP_Error( 'unauthorized', 'ログインが必要です', [ 'status' => 401 ] );
    }
    // X-WP-Nonce ヘッダを優先、なければ X-Tenrec-Nonce も確認（いずれも wp_rest nonce で検証）
    $nonce = $req->get_header( 'X-WP-Nonce' ) ?: $req->get_header( 'X-Tenrec-Nonce' );
    if ( ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
        return new WP_Error( 'rest_cookie_invalid_nonce', 'Cookieチェック失敗', [ 'status' => 403 ] );
    }
    return true;
}

// ============================================================
// 日次記録 CRUD
// ============================================================
function tenrec_get_daily( WP_REST_Request $req ) {
    global $wpdb;
    $from = sanitize_text_field( $req->get_param('from') ?: '00000000' );
    $to   = sanitize_text_field( $req->get_param('to')   ?: '99999999' );
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT ymd, supervisor, manager, manager2, helper, helper2, entries FROM {$wpdb->prefix}tenrec_daily WHERE ymd BETWEEN %s AND %s ORDER BY ymd",
        $from, $to
    ), ARRAY_A );

    $result = [];
    foreach ( $rows as $r ) {
        $result[ $r['ymd'] ] = [
            'supervisor' => $r['supervisor'],
            'manager'    => $r['manager'],
            'manager2'   => $r['manager2'],
            'helper'     => $r['helper'],
            'helper2'    => $r['helper2'],
            'entries'    => json_decode( $r['entries'], true ) ?: [],
        ];
    }
    return rest_ensure_response( $result );
}

function tenrec_get_daily_one( WP_REST_Request $req ) {
    global $wpdb;
    $ymd = sanitize_text_field( $req->get_param('ymd') );
    $row = $wpdb->get_row( $wpdb->prepare(
        "SELECT supervisor, manager, manager2, helper, helper2, entries FROM {$wpdb->prefix}tenrec_daily WHERE ymd = %s",
        $ymd
    ), ARRAY_A );
    if ( ! $row ) return rest_ensure_response( null );
    return rest_ensure_response([
        'supervisor' => $row['supervisor'],
        'manager'    => $row['manager'],
        'manager2'   => $row['manager2'],
        'helper'     => $row['helper'],
        'helper2'    => $row['helper2'],
        'entries'    => json_decode( $row['entries'], true ) ?: [],
    ]);
}

function tenrec_save_daily( WP_REST_Request $req ) {
    global $wpdb;
    $body    = $req->get_json_params();
    $ymd        = sanitize_text_field( $body['ymd'] ?? '' );
    $supervisor = sanitize_text_field( $body['supervisor'] ?? '' );
    $manager    = sanitize_text_field( $body['manager'] ?? '' );
    $manager2   = sanitize_text_field( $body['manager2'] ?? '' );
    $helper     = sanitize_text_field( $body['helper'] ?? '' );
    $helper2    = sanitize_text_field( $body['helper2'] ?? '' );
    $entries    = wp_json_encode( $body['entries'] ?? [] );

    if ( ! preg_match( '/^\d{8}$/', $ymd ) ) {
        return new WP_Error( 'invalid_ymd', '日付形式が不正です(YYYYMMDD)', [ 'status' => 400 ] );
    }

    $wpdb->query( $wpdb->prepare(
        "INSERT INTO {$wpdb->prefix}tenrec_daily (ymd, supervisor, manager, manager2, helper, helper2, entries)
         VALUES (%s, %s, %s, %s, %s, %s, %s)
         ON DUPLICATE KEY UPDATE supervisor=%s, manager=%s, manager2=%s, helper=%s, helper2=%s, entries=%s",
        $ymd, $supervisor, $manager, $manager2, $helper, $helper2, $entries,
        $supervisor, $manager, $manager2, $helper, $helper2, $entries
    ));

    return rest_ensure_response( [ 'ok' => true ] );
}

function tenrec_del_daily( WP_REST_Request $req ) {
    global $wpdb;
    $ymd = sanitize_text_field( $req->get_param('ymd') );
    $wpdb->delete( "{$wpdb->prefix}tenrec_daily", [ 'ymd' => $ymd ] );
    return rest_ensure_response( [ 'ok' => true ] );
}

// ============================================================
// 執行者マスタ CRUD
// ============================================================
function tenrec_get_execs() {
    global $wpdb;
    $rows = $wpdb->get_results(
        "SELECT id, name, day_type, start_time, end_time FROM {$wpdb->prefix}tenrec_execs ORDER BY sort_order, id",
        ARRAY_A
    );
    return rest_ensure_response( array_map( fn($r) => [
        'id'    => (int) $r['id'],
        'name'  => $r['name'],
        'day'   => $r['day_type'],
        'start' => $r['start_time'],
        'end'   => $r['end_time'],
    ], $rows ) );
}

function tenrec_save_exec( WP_REST_Request $req ) {
    global $wpdb;
    $body = $req->get_json_params();
    $wpdb->insert( "{$wpdb->prefix}tenrec_execs", [
        'name'       => sanitize_text_field( $body['name'] ?? '' ),
        'day_type'   => sanitize_text_field( $body['day'] ?? '全日' ),
        'start_time' => sanitize_text_field( $body['start'] ?? '' ),
        'end_time'   => sanitize_text_field( $body['end'] ?? '' ),
    ]);
    return rest_ensure_response( [ 'id' => $wpdb->insert_id ] );
}

function tenrec_del_exec( WP_REST_Request $req ) {
    global $wpdb;
    $id = (int) $req->get_param('id');
    $wpdb->delete( "{$wpdb->prefix}tenrec_execs", [ 'id' => $id ] );
    return rest_ensure_response( [ 'ok' => true ] );
}

// ============================================================
// 車両マスタ CRUD
// ============================================================
function tenrec_get_vehicles() {
    global $wpdb;
    $rows = $wpdb->get_results(
        "SELECT * FROM {$wpdb->prefix}tenrec_vehicles ORDER BY sort_order, CAST(seq AS UNSIGNED), id",
        ARRAY_A
    );
    return rest_ensure_response( array_map( fn($r) => [
        'id'      => (int) $r['id'],
        'seq'     => $r['seq'],
        'bureau'  => $r['bureau'],
        'classNo' => $r['class_no'],
        'usage'   => $r['usage_type'],
        'num'     => $r['num'],
        'type'    => $r['vehicle_type'],
        'driver'  => $r['driver'],
        'tel'     => $r['tel'],
    ], $rows ) );
}

function tenrec_save_vehicle( WP_REST_Request $req ) {
    global $wpdb;
    $b = $req->get_json_params();
    $wpdb->insert( "{$wpdb->prefix}tenrec_vehicles", [
        'seq'          => sanitize_text_field( $b['seq'] ?? '' ),
        'bureau'       => sanitize_text_field( $b['bureau'] ?? '' ),
        'class_no'     => sanitize_text_field( $b['classNo'] ?? '' ),
        'usage_type'   => sanitize_text_field( $b['usage'] ?? '' ),
        'num'          => sanitize_text_field( $b['num'] ?? '' ),
        'vehicle_type' => sanitize_text_field( $b['type'] ?? '' ),
        'driver'       => sanitize_text_field( $b['driver'] ?? '' ),
        'tel'          => sanitize_text_field( $b['tel'] ?? '' ),
    ]);
    return rest_ensure_response( [ 'id' => $wpdb->insert_id ] );
}

function tenrec_update_vehicle( WP_REST_Request $req ) {
    global $wpdb;
    $id = (int) $req->get_param('id');
    $b  = $req->get_json_params();
    $wpdb->update( "{$wpdb->prefix}tenrec_vehicles", [
        'seq'          => sanitize_text_field( $b['seq'] ?? '' ),
        'bureau'       => sanitize_text_field( $b['bureau'] ?? '' ),
        'class_no'     => sanitize_text_field( $b['classNo'] ?? '' ),
        'usage_type'   => sanitize_text_field( $b['usage'] ?? '' ),
        'num'          => sanitize_text_field( $b['num'] ?? '' ),
        'vehicle_type' => sanitize_text_field( $b['type'] ?? '' ),
        'driver'       => sanitize_text_field( $b['driver'] ?? '' ),
        'tel'          => sanitize_text_field( $b['tel'] ?? '' ),
    ], [ 'id' => $id ] );
    return rest_ensure_response( [ 'ok' => true ] );
}

function tenrec_del_vehicle( WP_REST_Request $req ) {
    global $wpdb;
    $id = (int) $req->get_param('id');
    $wpdb->delete( "{$wpdb->prefix}tenrec_vehicles", [ 'id' => $id ] );
    return rest_ensure_response( [ 'ok' => true ] );
}

function tenrec_bulk_vehicles( WP_REST_Request $req ) {
    global $wpdb;
    $body    = $req->get_json_params();
    $items   = $body['items'] ?? [];
    $added   = 0;
    $updated = 0;

    foreach ( $items as $b ) {
        $key = implode( '_', [
            sanitize_text_field( $b['bureau'] ?? '' ),
            sanitize_text_field( $b['classNo'] ?? '' ),
            sanitize_text_field( $b['usage'] ?? '' ),
            sanitize_text_field( $b['num'] ?? '' ),
        ]);
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}tenrec_vehicles
             WHERE CONCAT(bureau,'_',class_no,'_',usage_type,'_',num) = %s",
            $key
        ));

        $data = [
            'seq'          => sanitize_text_field( $b['seq'] ?? '' ),
            'bureau'       => sanitize_text_field( $b['bureau'] ?? '' ),
            'class_no'     => sanitize_text_field( $b['classNo'] ?? '' ),
            'usage_type'   => sanitize_text_field( $b['usage'] ?? '' ),
            'num'          => sanitize_text_field( $b['num'] ?? '' ),
            'vehicle_type' => sanitize_text_field( $b['type'] ?? '' ),
            'driver'       => sanitize_text_field( $b['driver'] ?? '' ),
            'tel'          => sanitize_text_field( $b['tel'] ?? '' ),
        ];

        if ( $existing ) {
            $wpdb->update( "{$wpdb->prefix}tenrec_vehicles", $data, [ 'id' => $existing ] );
            $updated++;
        } else {
            $wpdb->insert( "{$wpdb->prefix}tenrec_vehicles", $data );
            $added++;
        }
    }

    return rest_ensure_response( [ 'added' => $added, 'updated' => $updated ] );
}