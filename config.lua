Config = {}

---------------------------------------------------------------------
-- 基本設定
---------------------------------------------------------------------

-- タブレットとして扱うアイテム名 (ox_inventory の items.lua に登録してください)
Config.TabletItem = 'tablet'

-- true: タブレットアイテムを持っていないとコマンド/キーで開けない
Config.RequireItem = true

-- 開くためのコマンド (false で無効)
Config.Command = 'tablet'

-- 開くためのキーバインド (false で無効 / 例: 'F10')
-- プレイヤーは GTA の設定 > キー割り当て > FiveM から変更できます
Config.Keybind = false

-- タブレットを持つアニメーションとプロップ
Config.Animation = {
    enabled = true,
    dict = 'amb@code_human_in_bus_passenger_idles@female@tablet@base',
    clip = 'base',
    prop = `prop_cs_tablet`,
    bone = 60309,
    offset = vec3(0.03, 0.002, -0.0),
    rotation = vec3(10.0, 160.0, 0.0),
}

-- 死亡中/手錠中などは開けないようにする
Config.BlockWhenDead = true

---------------------------------------------------------------------
-- アプリ専用端末アイテム (任意)
-- アイテムを使うと、そのアプリだけが開ける「専用端末モード」でタブレットを起動します。
--   ・ホーム画面 / 他のアプリ / コントロールセンターには行けません
--   ・閉じて開き直すと、毎回アプリのトップ画面から始まります
--   ・タブレット本体を持っていなくても使えます / 職業制限・未インストールでも開けます
-- 例: ['racing_tablet'] = 'racing'
-- ※ 外部スクリプトからは RegisterApp の deviceItem か exports.cam_tablet:RegisterAppItem でも登録できます
---------------------------------------------------------------------
Config.AppItems = {
    -- ['calculator_device'] = 'calculator',
}

-- true: 専用端末モードで開く / false: 通常のタブレットとして開いてそのアプリを起動
Config.AppItemStandalone = true

-- 専用端末モードでホームバーを押した時の動作
--   'restart' : アプリをトップ画面から開き直す
--   'close'   : タブレットを閉じる
Config.AppItemHome = 'restart'

---------------------------------------------------------------------
-- アプリ
---------------------------------------------------------------------

-- 初回起動時にインストール済みのアプリ
Config.DefaultApps = { 'store', 'settings', 'notes', 'calculator', 'clock' }

-- ドックに表示するアプリ (インストールされている物のみ表示)
Config.DockApps = { 'store', 'notes', 'calculator', 'settings' }

-- 利用条件 (職業など) を満たさないアプリをストアから隠す (false の場合はロック表示)
Config.HideRestrictedApps = true

-- 職業/ギャングの判定方法 (QBox 標準のマルチジョブ)
-- true : 掛け持ちしている職業・ギャングすべてで判定 (PlayerData.jobs / gangs)。職業を切り替えてもアプリは消えない
-- false: 今の職業・ギャング (PlayerData.job / gang) だけで判定。切り替えると条件外のアプリは自動で削除される
Config.MultiJob = true

-- ダウンロード演出の速度 (1MB あたりのミリ秒 / 最小 / 最大)
Config.Download = { msPerMB = 60, min = 1200, max = 8000 }

-- ストレージ容量 (MB) ※表示用
Config.StorageMB = 32768

--[[
アプリ定義
    id          : 一意のID (組み込みアプリは html/js/apps/<id>.js と対応)
    label       : 表示名
    description : ストアに表示する説明
    icon        : Font Awesome のクラス (例: 'fa-solid fa-calculator') または画像URL
    color       : アイコンの背景色
    category    : ストアのカテゴリ
    developer   : 開発元 (表示用)
    size        : サイズ MB (表示/ダウンロード演出用)
    system      : true で全員にインストール済み & アンインストール不可
    autoInstall : true で利用条件 (jobs/gangs) を満たす人に自動インストール & 削除不可。条件を外れると自動で削除
    featured    : true でストアのおすすめに表示
    url         : 外部アプリ (iframe) のURL  例: 'nui://my_resource/html/index.html'
                  ※ 外部スクリプトからは exports.cam_tablet:RegisterApp でも追加できます (README 参照)
    jobs        : 利用できる職業 { police = 0 } (数字は必要な最低グレード) / { 'police', 'ambulance' }
                  条件を満たさなくなったアプリは次にタブレットを開いた時 (開いている間の転職なら即時) に自動でアンインストールされます
    gangs       : 利用できるギャング (jobs と同じ形式。jobs と gangs はどちらかを満たせばOK)
    item        : インストールに必要なアイテム (インストール時だけ確認。インストール後は持っていなくても使える)
    consumeItem : true でインストール時に item を消費
    deviceItem  : このアプリ専用端末にするアイテム (例: 'racing_tablet')  Config.AppItems と同じ動作
]]
Config.Apps = {
    {
        id = 'store', label = 'App Store', icon = 'fa-solid fa-bag-shopping', color = '#0a84ff',
        category = 'システム', developer = 'CamTab', size = 48, system = true,
        description = 'アプリを探してダウンロードできます。',
    },
    {
        id = 'settings', label = '設定', icon = 'fa-solid fa-gear', color = '#8e8e93',
        category = 'システム', developer = 'CamTab', size = 36, system = true,
        description = '壁紙・テーマ・ロック画面などを変更できます。',
    },
    {
        id = 'notes', label = 'メモ', icon = 'fa-solid fa-note-sticky', color = '#ffcc00',
        category = '仕事効率化', developer = 'CamTab', size = 18,
        description = 'メモを作成して保存できます。メモはキャラクターごとに保存されます。',
    },
    {
        id = 'calculator', label = '電卓', icon = 'fa-solid fa-calculator', color = '#ff9f0a',
        category = 'ユーティリティ', developer = 'CamTab', size = 6,
        description = 'シンプルな電卓。キーボード入力にも対応しています。',
    },
    {
        id = 'clock', label = '時計', icon = 'fa-solid fa-clock', color = '#1c1c1e',
        category = 'ユーティリティ', developer = 'CamTab', size = 12,
        description = '現実時間とゲーム内時間の表示、ストップウォッチ、タイマー。',
    },
    {
        id = 'calendar', label = 'カレンダー', icon = 'fa-solid fa-calendar-days', color = '#ff3b30',
        category = '仕事効率化', developer = 'CamTab', size = 14, featured = true,
        description = '月表示のカレンダー。予定を日付ごとに書き込めます。',
    },
    {
        id = 'profile', label = 'マイ情報', icon = 'fa-solid fa-id-card', color = '#34c759',
        category = 'ライフスタイル', developer = 'CamTab', size = 10, featured = true,
        description = '自分の名前・職業・所持金などを確認できます。',
    },
    {
        id = 'guide', label = 'サーバーガイド', icon = 'fa-solid fa-book-open', color = '#5e5ce6',
        category = '情報', developer = 'Server Staff', size = 8, featured = true,
        description = 'サーバーのルールや案内を確認できます。',
    },
    --[[ 職業限定アプリの例 (url で自作のNUIページを読み込みます)
    {
        id = 'mdt', label = 'MDT', icon = 'fa-solid fa-shield-halved', color = '#0040dd',
        category = '業務', developer = 'LSPD', size = 64,
        url = 'nui://my_mdt/html/index.html',
        jobs = { police = 0 },
        description = '警察用データ端末',
    },
    ]]
    --[[ アイテムが無いとインストールできないアプリの例
    {
        id = 'darknet', label = 'Darknet', icon = 'fa-solid fa-user-secret', color = '#111111',
        category = 'その他', developer = '???', size = 3,
        url = 'nui://my_darknet/html/index.html',
        item = 'usb_darknet', consumeItem = true,
        description = '???',
    },
    ]]
}

---------------------------------------------------------------------
-- 壁紙
-- src : html/ からの相対パス、または URL
-- css : CSS の background 値 (グラデーションなど)
-- 画像を追加する場合は html/wallpapers/ に置いて src = 'wallpapers/xxx.jpg' と書いてください
---------------------------------------------------------------------
Config.Wallpapers = {
    { id = 'aurora', label = 'オーロラ', src = 'wallpapers/aurora.svg' },
    { id = 'dunes', label = '砂丘', src = 'wallpapers/dunes.svg' },
    { id = 'city', label = 'ナイトシティ', src = 'wallpapers/city.svg' },
    { id = 'waves', label = 'ウェーブ', src = 'wallpapers/waves.svg' },
    { id = 'sunset', label = 'サンセット', css = 'linear-gradient(160deg, #ff7e5f 0%, #feb47b 45%, #6a3093 100%)' },
    { id = 'ocean', label = 'オーシャン', css = 'linear-gradient(160deg, #00c6ff 0%, #0072ff 50%, #001a4d 100%)' },
    { id = 'forest', label = 'フォレスト', css = 'linear-gradient(160deg, #a8e063 0%, #2f7336 55%, #0b2e13 100%)' },
    { id = 'mono', label = 'グラファイト', css = 'linear-gradient(160deg, #434343 0%, #1a1a1a 100%)' },
}

Config.DefaultWallpaper = 'aurora'

-- プレイヤーが画像URLを壁紙に設定できるようにする
Config.AllowCustomWallpaper = true

-- アクセントカラーの候補
Config.AccentColors = { '#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#bf5af2', '#64d2ff', '#ffd60a', '#ff453a' }

---------------------------------------------------------------------
-- メモ / カレンダー の保存上限
---------------------------------------------------------------------
Config.Limits = {
    notes = 50,          -- メモの最大数
    noteTitle = 60,      -- タイトル最大文字数
    noteBody = 4000,     -- 本文最大文字数
    events = 200,        -- カレンダー予定の最大数
    eventText = 100,     -- 予定の最大文字数
}

---------------------------------------------------------------------
-- サーバーガイドアプリの内容
---------------------------------------------------------------------
Config.Guide = {
    title = 'ようこそ！',
    subtitle = 'サーバーの基本ルールと案内',
    sections = {
        { icon = 'fa-solid fa-scale-balanced', title = '基本ルール', body = '他のプレイヤーを尊重し、ロールプレイを楽しみましょう。\nRDM / VDM / メタゲームは禁止です。' },
        { icon = 'fa-solid fa-briefcase', title = '仕事', body = '市役所で職業を選択できます。\n警察・救急への応募は Discord から。' },
        { icon = 'fa-brands fa-discord', title = 'Discord', body = 'お問い合わせやお知らせは Discord をご確認ください。' },
    },
}

---------------------------------------------------------------------
-- 表示メッセージ (Lua側)
---------------------------------------------------------------------
Config.Locale = {
    noTablet = 'タブレットを持っていません',
    cannotUse = '今はタブレットを使えません',
    installed = 'インストールしました',
    notFound = 'アプリが見つかりません',
    noAccess = 'このアプリを利用する権限がありません',
    needItem = 'インストールには %s が必要です',
    already = '既にインストールされています',
    saveFailed = '保存に失敗しました。時間をおいてもう一度お試しください',
    system = 'このアプリは削除できません',
    keybind = 'タブレットを開く',
}
