-- タブレットにアプリを登録する
-- cam_tablet が後から起動/再起動した場合にも登録されるよう 'cam_tablet:ready' でも登録します
local function register()
    exports.cam_tablet:RegisterApp({
        id = 'example_app',
        label = 'サンプル',
        description = '外部スクリプトから追加したアプリのサンプルです。',
        icon = 'fa-solid fa-flask',           -- Font Awesome クラス or 画像URL
        color = '#bf5af2',
        category = '開発者',
        developer = 'cam_tablet_example',
        size = 4,
        url = ('nui://%s/html/index.html'):format(GetCurrentResourceName()),
        -- jobs = { police = 0 },             -- 職業制限
        -- item = 'usb_example',              -- インストールに必要なアイテム
        -- system = true,                     -- 全員にインストール済み & 削除不可
    })
end

AddEventHandler('cam_tablet:ready', register)

CreateThread(function()
    if GetResourceState('cam_tablet') == 'started' then register() end
end)

-- iframe -> client (post) -> server の例
lib.callback.register('cam_tablet_example:server:getInfo', function(source)
    return {
        serverTime = os.date('%Y/%m/%d %H:%M:%S'),
        players = #GetPlayers(),
    }
end)

-- 例: 誰かにアプリを付与する / 通知する
-- exports.cam_tablet:InstallApp(source, 'example_app')
-- exports.cam_tablet:Notify(source, { title = 'サンプル', message = 'こんにちは', app = 'example_app' })
