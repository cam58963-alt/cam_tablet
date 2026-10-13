local Catalog, CatalogOrder = {}, {}
local DeviceItems = {}  -- item -> { app = appId, resource = resource }  (アプリ専用端末アイテム)
local Cache = {}       -- citizenid -> { apps, settings, notes, events }

---------------------------------------------------------------------
-- Utils
---------------------------------------------------------------------

local function clip(value, max)
    local s = tostring(value or '')
    local len = utf8.len(s)
    if not len then return '' end
    if len <= max then return s end
    return s:sub(1, utf8.offset(s, max + 1) - 1)
end

local function contains(list, value)
    for i = 1, #list do
        if list[i] == value then return i end
    end
end

local function copy(list)
    local out = {}
    for i = 1, #list do out[i] = list[i] end
    return out
end

local function getPlayer(src)
    return exports.qbx_core:GetPlayer(src)
end

local function itemCount(src, item)
    return exports.ox_inventory:GetItemCount(src, item) or 0
end

local itemLabels = {}
local function itemLabel(item)
    if itemLabels[item] == nil then
        local data = exports.ox_inventory:Items(item)
        itemLabels[item] = data and data.label or item
    end
    return itemLabels[item]
end

local jobLabels
local function groupLabel(name)
    if not jobLabels then
        jobLabels = {}
        local ok, jobs = pcall(function() return exports.qbx_core:GetJobs() end)
        if ok and jobs then
            for k, v in pairs(jobs) do jobLabels[k] = v.label end
        end
        local ok2, gangs = pcall(function() return exports.qbx_core:GetGangs() end)
        if ok2 and gangs then
            for k, v in pairs(gangs) do jobLabels[k] = jobLabels[k] or v.label end
        end
    end
    return jobLabels[name] or name
end

---------------------------------------------------------------------
-- App catalog
---------------------------------------------------------------------

local function normalizeGroups(groups)
    if type(groups) ~= 'table' then return nil end
    local out = {}
    for k, v in pairs(groups) do
        if type(k) == 'number' then
            out[v] = 0
        else
            out[k] = tonumber(v) or 0
        end
    end
    return next(out) and out or nil
end

--- アイテムを使うと、そのアプリだけを開く専用端末モードでタブレットを起動する
local function registerDeviceItem(item, appId, resource)
    if type(item) ~= 'string' or item == '' or type(appId) ~= 'string' then return false end
    local isNew = DeviceItems[item] == nil
    DeviceItems[item] = { app = appId, resource = resource }
    if isNew then
        exports.qbx_core:CreateUseableItem(item, function(source)
            local entry = DeviceItems[item]
            if not entry then return end
            TriggerClientEvent('cam_tablet:client:open', source, entry.app, Config.AppItemStandalone, true)
        end)
    end
    return true
end

-- iframe の URL からページを持っているリソース名を取り出す (SDK の CamTablet.post() の送信先)
local function urlResource(url)
    if type(url) ~= 'string' then return nil end
    return url:match('^nui://([^/]+)/') or url:match('^https?://cfx%-nui%-([^/]+)/')
end

local function registerApp(app, resource)
    if type(app) ~= 'table' or type(app.id) ~= 'string' or not app.id:match('^[%w_%-]+$') then
        lib.print.warn(('RegisterApp: invalid app id (%s) from %s'):format(tostring(app and app.id), resource))
        return false
    end
    if app.url ~= nil and type(app.url) ~= 'string' then
        lib.print.warn(('RegisterApp: url must be a string (%s)'):format(app.id))
        return false
    end
    local existing = Catalog[app.id]
    if existing and existing.resource ~= resource then
        -- 別のリソースが登録済みの ID は上書きさせない (他のアプリの URL を差し替えられないように)
        -- 登録元が停止すればそのアプリは自動で消えるので、同じ ID はその後に登録できる
        lib.print.warn(('RegisterApp: %s tried to override app %s owned by %s'):format(resource, app.id, existing.resource))
        return false
    end

    local entry = {
        id = app.id,
        label = app.label or app.id,
        description = app.description or '',
        icon = app.icon or 'fa-solid fa-cube',
        color = app.color or '#5e5ce6',
        category = app.category or 'その他',
        developer = app.developer or 'Unknown',
        size = tonumber(app.size) or 10,
        url = app.url,
        system = app.system == true,
        autoInstall = app.autoInstall == true,
        featured = app.featured == true,
        jobs = normalizeGroups(app.jobs),
        gangs = normalizeGroups(app.gangs),
        item = app.item,
        consumeItem = app.consumeItem == true,
        resource = resource, -- 登録元 (停止時に自動削除する対象)
        uiResource = urlResource(app.url) or resource,
    }

    if not Catalog[entry.id] then
        CatalogOrder[#CatalogOrder + 1] = entry.id
    end
    Catalog[entry.id] = entry

    -- deviceItem = 'racing_tablet' または { 'a', 'b' } でアプリ専用アイテムを登録
    -- 再登録時は、同じ登録元が以前付けた紐付けを消してから付け直す (deviceItem を外した / 変えた場合に古いアイテムが残らないように)
    for item, dev in pairs(DeviceItems) do
        if dev.app == entry.id and dev.resource == resource then DeviceItems[item] = nil end
    end
    local devices = app.deviceItem
    if type(devices) == 'string' then devices = { devices } end
    if type(devices) == 'table' then
        for i = 1, #devices do registerDeviceItem(devices[i], entry.id, resource) end
    end
    return true
end

local function removeApp(id)
    if not Catalog[id] then return false end
    Catalog[id] = nil
    local idx = contains(CatalogOrder, id)
    if idx then table.remove(CatalogOrder, idx) end
    -- 専用端末アイテムの紐付けも消す (同じIDで別のアプリが登録された時に古いアイテムで開けないように)
    for item, entry in pairs(DeviceItems) do
        if entry.app == id then DeviceItems[item] = nil end
    end
    return true
end

CreateThread(function()
    for i = 1, #Config.Apps do
        registerApp(Config.Apps[i], GetCurrentResourceName())
    end
    for item, appId in pairs(Config.AppItems) do
        registerDeviceItem(item, appId, GetCurrentResourceName())
    end
end)

local function hasAccess(player, app)
    if not app.jobs and not app.gangs then return true end

    local pd = player.PlayerData
    local job, gang = pd.job, pd.gang

    if app.jobs and job and app.jobs[job.name] and ((job.grade and job.grade.level) or 0) >= app.jobs[job.name] then
        return true
    end

    if app.gangs and gang and app.gangs[gang.name] and ((gang.grade and gang.grade.level) or 0) >= app.gangs[gang.name] then
        return true
    end

    return false
end

local function groupNames(groups)
    if not groups then return nil end
    local out = {}
    for name in pairs(groups) do out[#out + 1] = groupLabel(name) end
    return out
end

local function buildCatalog(src, player, forceId)
    local list = {}
    for i = 1, #CatalogOrder do
        local app = Catalog[CatalogOrder[i]]
        -- 専用アイテムで開いた場合は職業制限に関係なく対象アプリを使える
        local access = app.id == forceId or hasAccess(player, app)
        if access or not Config.HideRestrictedApps then
            list[#list + 1] = {
                id = app.id,
                label = app.label,
                description = app.description,
                icon = app.icon,
                color = app.color,
                category = app.category,
                developer = app.developer,
                size = app.size,
                url = app.url,
                system = app.system,
                autoInstall = app.autoInstall or nil,
                featured = app.featured,
                locked = not access,
                groups = groupNames(app.jobs) or groupNames(app.gangs),
                item = app.item,
                itemLabel = app.item and itemLabel(app.item) or nil,
                hasItem = app.item and itemCount(src, app.item) > 0 or nil,
                consumeItem = app.consumeItem or nil,
                resource = app.uiResource,
            }
        end
    end
    return list
end

---------------------------------------------------------------------
-- Persistence
---------------------------------------------------------------------

local dbReady = false

CreateThread(function()
    local ok, err = pcall(MySQL.query.await, [[
        CREATE TABLE IF NOT EXISTS `cam_tablet` (
            `citizenid` VARCHAR(50) NOT NULL,
            `apps` LONGTEXT NULL,
            `settings` LONGTEXT NULL,
            `notes` LONGTEXT NULL,
            `events` LONGTEXT NULL,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`citizenid`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
    if not ok then lib.print.error(('failed to create table: %s'):format(err)) end
    -- 失敗してもリクエストを待たせ続けないよう準備完了にする (エラーは各クエリ側でも出る)
    dbReady = true
end)

local function decode(str, fallback)
    if type(str) ~= 'string' or str == '' then return fallback end
    local ok, result = pcall(json.decode, str)
    if ok and type(result) == 'table' then return result end
    return fallback
end

local SAVE_QUERY = 'INSERT INTO `cam_tablet` (`citizenid`, `apps`, `settings`, `notes`, `events`) VALUES (?, ?, ?, ?, ?) ' ..
    'ON DUPLICATE KEY UPDATE `apps` = VALUES(`apps`), `settings` = VALUES(`settings`), `notes` = VALUES(`notes`), `events` = VALUES(`events`)'

local Writing, PendingWrite = {}, {} -- citizenid -> true / 次に書き込むデータ
local LastWriteOk = {}                -- citizenid -> 直近の書き込みが成功したか
local EvictAfterWrite = {}            -- citizenid -> 書き込み完了後にキャッシュを破棄する
local SourceCid = {}                  -- source -> citizenid

local function isActive(cid)
    for _, active in pairs(SourceCid) do
        if active == cid then return true end
    end
    return false
end

-- 1キャラクターにつき書き込みは常に1本だけ。書き込み中の保存はまとめて、終わった後に最新の状態で1回書く
-- (並列に投げると古いスナップショットが後から完了して新しい内容を上書きすることがある)
--- data を省略するとキャッシュの内容を保存する (キャッシュ破棄後でも手元のデータを確実に保存できるよう指定可能)
local function persist(cid, data)
    data = data or Cache[cid]
    if not data then return end
    if Writing[cid] then
        PendingWrite[cid] = data
        return
    end

    Writing[cid] = true
    CreateThread(function()
        while data do
            local ok, err = pcall(MySQL.query.await, SAVE_QUERY,
                { cid, json.encode(data.apps), json.encode(data.settings), json.encode(data.notes), json.encode(data.events) })
            if not ok then lib.print.error(('failed to save %s: %s'):format(cid, err)) end
            LastWriteOk[cid] = ok
            data = PendingWrite[cid]
            PendingWrite[cid] = nil
        end
        Writing[cid] = nil
        -- ログアウト済みなら、書き込みが終わってからキャッシュを破棄する (途中で消すと再ログイン時に古いDBを読む)
        if EvictAfterWrite[cid] then
            EvictAfterWrite[cid] = nil
            if not isActive(cid) then Cache[cid] = nil end
        end
    end)
end

--- キャラクターのキャッシュを破棄する。書き込み中なら完了後に破棄する
local function evict(cid)
    if not cid then return end
    if Writing[cid] then
        EvictAfterWrite[cid] = true
    else
        Cache[cid] = nil
    end
end

--- 保存して書き込み完了まで待つ。成功したら true (アイテム消費など取り消せない処理の前に使う)
local function persistAwait(cid, data)
    persist(cid, data)
    while Writing[cid] do Wait(50) end
    return LastWriteOk[cid] == true
end

local function loadData(cid)
    if Cache[cid] then return Cache[cid] end
    -- 初回起動時はテーブル作成が終わるまで待つ
    while not dbReady do Wait(50) end
    if Cache[cid] then return Cache[cid] end

    local row = MySQL.single.await('SELECT `apps`, `settings`, `notes`, `events` FROM `cam_tablet` WHERE `citizenid` = ?', { cid })
    local data
    if row then
        data = {
            apps = decode(row.apps, copy(Config.DefaultApps)),
            settings = decode(row.settings, {}),
            notes = decode(row.notes, {}),
            events = decode(row.events, {}),
        }
    else
        data = { apps = copy(Config.DefaultApps), settings = {}, notes = {}, events = {} }
    end

    -- DB を待っている間に別の処理が先に読み込み済みなら、そちらを使う (後から上書きすると先の変更が消える)
    if Cache[cid] then return Cache[cid] end
    -- DB を待っている間にログアウト / 切断していたらキャッシュに入れない (破棄済みのため残り続けてしまう)
    if not isActive(cid) then return data end
    Cache[cid] = data
    if not row then persist(cid) end
    return data
end

-- システムアプリ (後から登録された外部アプリも含む) は常にインストール済みにする
local function ensureSystemApps(data, cid)
    local changed = false
    for i = #CatalogOrder, 1, -1 do
        local app = Catalog[CatalogOrder[i]]
        if app.system and not contains(data.apps, app.id) then
            table.insert(data.apps, 1, app.id)
            changed = true
        end
    end
    if changed then persist(cid) end
end

-- autoInstall = true のアプリは、利用条件を満たしている人に自動でインストールする
local function installAutoApps(data, player, cid)
    local added = {}
    for i = 1, #CatalogOrder do
        local app = Catalog[CatalogOrder[i]]
        if app.autoInstall and not contains(data.apps, app.id) and hasAccess(player, app) then
            data.apps[#data.apps + 1] = app.id
            added[#added + 1] = app.label
        end
    end
    if #added > 0 then persist(cid) end
    return added
end

-- 職業/ギャング変更などで利用条件を満たさなくなったアプリは自動でアンインストールする
local function pruneRestrictedApps(data, player, cid)
    local removed = {}
    for i = #data.apps, 1, -1 do
        local app = Catalog[data.apps[i]]
        if app and not app.system and not hasAccess(player, app) then
            table.remove(data.apps, i)
            table.insert(removed, 1, app.label)
        end
    end
    if #removed > 0 then persist(cid) end
    return removed
end

local function getData(src)
    local player = getPlayer(src)
    if not player then return end
    local cid = player.PlayerData.citizenid
    -- 切断せずにキャラクターを切り替えた場合、前のキャラクターのキャッシュを破棄する
    local previous = SourceCid[src]
    SourceCid[src] = cid
    if previous and previous ~= cid then evict(previous) end
    EvictAfterWrite[cid] = nil
    local data = loadData(cid)
    ensureSystemApps(data, cid)
    local removed = pruneRestrictedApps(data, player, cid)
    local added = installAutoApps(data, player, cid)
    return data, player, cid, removed, added
end

local function onPlayerLeft(src)
    local cid = SourceCid[src]
    SourceCid[src] = nil
    evict(cid)
end

AddEventHandler('playerDropped', function() onPlayerLeft(source) end)
-- キャラクター選択に戻った時 (QBox 本体のイベント)
AddEventHandler('qbx_core:server:playerLoggedOut', onPlayerLeft)

---------------------------------------------------------------------
-- Validation
---------------------------------------------------------------------

local wallpaperIds = {}
for i = 1, #Config.Wallpapers do wallpaperIds[Config.Wallpapers[i].id] = true end

local function validUrl(url)
    if type(url) ~= 'string' or #url > 512 then return false end
    if not url:match('^https?://') then return false end
    -- CSS の url() を壊す文字は拒否
    if url:find('[%s"\'%(%)\\<>]') then return false end
    return true
end

local SettingsSchema = {
    theme = function(v) return v == 'dark' or v == 'light' end,
    accent = function(v) return type(v) == 'string' and v:match('^#%x%x%x%x%x%x$') ~= nil end,
    wallpaper = function(v)
        if type(v) ~= 'string' then return false end
        local id = v:match('^preset:(.+)$')
        if id then return wallpaperIds[id] == true end
        local url = v:match('^url:(.+)$')
        return Config.AllowCustomWallpaper and url ~= nil and validUrl(url)
    end,
    wallpaperDim = function(v) return type(v) == 'number' and v >= 0 and v <= 80 end,
    brightness = function(v) return type(v) == 'number' and v >= 30 and v <= 100 end,
    scale = function(v) return type(v) == 'number' and v >= 60 and v <= 120 end,
    clock24 = function(v) return type(v) == 'boolean' end,
    timeSource = function(v) return v == 'real' or v == 'game' end,
    sounds = function(v) return type(v) == 'boolean' end,
    toasts = function(v) return type(v) == 'boolean' end,
    lockScreen = function(v) return type(v) == 'boolean' end,
    passcode = function(v) return type(v) == 'string' and (v == '' or v:match('^%d%d%d%d$') ~= nil) end,
    widgets = function(v) return type(v) == 'boolean' end,
    labels = function(v) return type(v) == 'boolean' end,
    iconSize = function(v) return v == 'small' or v == 'medium' or v == 'large' end,
    deviceName = function(v) return type(v) == 'string' end,
    dock = function(v)
        if v == false then return true end -- false = デフォルトに戻す
        if type(v) ~= 'table' or #v > 6 then return false end
        for i = 1, #v do
            if type(v[i]) ~= 'string' or #v[i] > 64 then return false end
        end
        return true
    end,
}

local function sanitizeSettings(current, input)
    if type(input) ~= 'table' then return current end
    local out = {}
    for k, v in pairs(current) do out[k] = v end
    for key, check in pairs(SettingsSchema) do
        local v = input[key]
        if v ~= nil and check(v) then
            if key == 'deviceName' then v = clip(v, 24) end
            if type(v) == 'number' then v = math.floor(v) end
            if key == 'dock' and v == false then v = nil end
            out[key] = v
        end
    end
    return out
end

local function sanitizeNotes(input)
    if type(input) ~= 'table' then return nil end
    local L = Config.Limits
    local out = {}
    for i = 1, math.min(#input, L.notes) do
        local n = input[i]
        if type(n) == 'table' then
            out[#out + 1] = {
                id = clip(n.id or i, 32),
                title = clip(n.title, L.noteTitle),
                body = clip(n.body, L.noteBody),
                pinned = n.pinned == true,
                updated = tonumber(n.updated) or (os.time() * 1000),
            }
        end
    end
    return out
end

local function sanitizeEvents(input)
    if type(input) ~= 'table' then return nil end
    local L = Config.Limits
    local out = {}
    for i = 1, math.min(#input, L.events) do
        local e = input[i]
        if type(e) == 'table' and type(e.date) == 'string' and e.date:match('^%d%d%d%d%-%d%d%-%d%d$') then
            out[#out + 1] = {
                id = clip(e.id or i, 32),
                date = e.date,
                time = type(e.time) == 'string' and e.time:match('^%d%d:%d%d$') and e.time or '',
                text = clip(e.text, L.eventText),
                color = type(e.color) == 'string' and e.color:match('^#%x%x%x%x%x%x$') and e.color or nil,
            }
        end
    end
    return out
end

local function canOpen(src)
    if not Config.RequireItem then return true end
    if itemCount(src, Config.TabletItem) > 0 then return true end
    return false
end

local function hasDeviceItem(src, appId)
    -- 対象アプリが存在しない (登録元が停止中など) なら許可しない
    if not appId or not Catalog[appId] then return false end
    for item, entry in pairs(DeviceItems) do
        if entry.app == appId and itemCount(src, item) > 0 then return true end
    end
    return false
end

local function filterInstalled(apps)
    local out = {}
    for i = 1, #apps do
        if Catalog[apps[i]] then out[#out + 1] = apps[i] end
    end
    return out
end

---------------------------------------------------------------------
-- Callbacks
---------------------------------------------------------------------

lib.callback.register('cam_tablet:server:getData', function(src, appId, viaDevice)
    if type(appId) ~= 'string' then appId = nil end
    local device = viaDevice == true and hasDeviceItem(src, appId)
    if not device and not canOpen(src) then return false end

    local data, player, _, removed, added = getData(src)
    if not data then return false end

    -- 初回はDB読み込みを待つので、その間にアイテムを手放していないか確認し直す
    if device then
        device = hasDeviceItem(src, appId)
        if not device and not canOpen(src) then return false end
    end

    return {
        device = device,
        removed = #removed > 0 and removed or nil,
        added = #added > 0 and added or nil,
        catalog = buildCatalog(src, player, device and appId or nil),
        installed = filterInstalled(data.apps),
        settings = data.settings,
        notes = data.notes,
        events = data.events,
    }
end)

local function result(ok, message, extra)
    local r = extra or {}
    r.ok = ok
    r.message = message
    return r
end

local function installApp(src, appId, force)
    local data, player, cid = getData(src)
    if not data then return result(false, Config.Locale.notFound) end

    local app = Catalog[appId]
    if not app then return result(false, Config.Locale.notFound) end
    if contains(data.apps, appId) then return result(false, Config.Locale.already, { installed = filterInstalled(data.apps) }) end

    if not force then
        if not canOpen(src) then return result(false, Config.Locale.noTablet) end
        if not hasAccess(player, app) then return result(false, Config.Locale.noAccess) end
        if app.item then
            if itemCount(src, app.item) < 1 then
                return result(false, Config.Locale.needItem:format(itemLabel(app.item)))
            end
        end
    end

    data.apps[#data.apps + 1] = appId

    if not force and app.item and app.consumeItem then
        -- アイテム消費は取り消せないので、インストールが DB に保存できたのを確認してから消費する
        local function rollback()
            local idx = contains(data.apps, appId)
            if idx then table.remove(data.apps, idx) end
            persist(cid, data)
        end
        if not persistAwait(cid, data) then
            rollback()
            return result(false, Config.Locale.saveFailed)
        end
        -- 保存を待っている間にログアウト / 切断して別キャラクターになっていたら消費しない
        local current = getPlayer(src)
        if not current or current.PlayerData.citizenid ~= cid then
            rollback()
            return result(false, Config.Locale.saveFailed)
        end
        -- 待っている間にアプリが削除 / 差し替え / アンインストールされていたら消費しない
        if Catalog[appId] ~= app or not contains(data.apps, appId) then
            rollback()
            return result(false, Config.Locale.notFound)
        end
        if not exports.ox_inventory:RemoveItem(src, app.item, 1) then
            rollback()
            return result(false, Config.Locale.needItem:format(itemLabel(app.item)))
        end
    else
        persist(cid)
    end

    return result(true, Config.Locale.installed, { installed = filterInstalled(data.apps) })
end

lib.callback.register('cam_tablet:server:install', function(src, appId)
    if type(appId) ~= 'string' then return result(false, Config.Locale.notFound) end
    return installApp(src, appId, false)
end)

lib.callback.register('cam_tablet:server:uninstall', function(src, appId)
    local data, _, cid = getData(src)
    if not data or type(appId) ~= 'string' then return result(false, Config.Locale.notFound) end

    local app = Catalog[appId]
    if app and (app.system or app.autoInstall) then return result(false, Config.Locale.system) end

    local idx = contains(data.apps, appId)
    if idx then
        table.remove(data.apps, idx)
        persist(cid)
    end
    return result(true, nil, { installed = filterInstalled(data.apps) })
end)

lib.callback.register('cam_tablet:server:reorder', function(src, order)
    local data, _, cid = getData(src)
    if not data or type(order) ~= 'table' then return false end

    -- 送られてきた順番のうち、インストール済みの物だけ採用し、漏れた物は末尾に残す
    local out, seen = {}, {}
    for i = 1, #order do
        local id = order[i]
        if type(id) == 'string' and not seen[id] and contains(data.apps, id) then
            out[#out + 1] = id
            seen[id] = true
        end
    end
    for i = 1, #data.apps do
        if not seen[data.apps[i]] then out[#out + 1] = data.apps[i] end
    end

    data.apps = out
    persist(cid)
    return true
end)

lib.callback.register('cam_tablet:server:saveSettings', function(src, settings)
    local data, _, cid = getData(src)
    if not data then return false end
    data.settings = sanitizeSettings(data.settings, settings)
    persist(cid)
    return data.settings
end)

lib.callback.register('cam_tablet:server:resetSettings', function(src)
    local data, _, cid = getData(src)
    if not data then return false end
    data.settings = {}
    persist(cid)
    return data.settings
end)

lib.callback.register('cam_tablet:server:saveNotes', function(src, notes)
    local data, _, cid = getData(src)
    local clean = sanitizeNotes(notes)
    if not data or not clean then return false end
    data.notes = clean
    persist(cid)
    return true
end)

lib.callback.register('cam_tablet:server:saveEvents', function(src, events)
    local data, _, cid = getData(src)
    local clean = sanitizeEvents(events)
    if not data or not clean then return false end
    data.events = clean
    persist(cid)
    return true
end)

---------------------------------------------------------------------
-- Usable items
---------------------------------------------------------------------

CreateThread(function()
    exports.qbx_core:CreateUseableItem(Config.TabletItem, function(source)
        TriggerClientEvent('cam_tablet:client:open', source)
    end)
end)

---------------------------------------------------------------------
-- Exports (server)
---------------------------------------------------------------------

local function catalogChanged()
    TriggerClientEvent('cam_tablet:client:catalogChanged', -1)
end

--- 他のリソースからアプリを登録する (フィールドは config.lua の Config.Apps と同じ)
--- exports.cam_tablet:RegisterApp({ id = 'myapp', label = 'My App', url = 'nui://my_resource/html/index.html', ... })
--- 複数まとめて登録する場合は配列で渡せます: exports.cam_tablet:RegisterApp({ {...}, {...} })
--- 登録したリソースが停止すると自動で削除されます
exports('RegisterApp', function(app)
    local resource = GetInvokingResource() or GetCurrentResourceName()
    local ok = true
    if type(app) == 'table' and app[1] then
        for i = 1, #app do ok = registerApp(app[i], resource) and ok end
    else
        ok = registerApp(app, resource)
    end
    catalogChanged()
    return ok
end)

--- アプリ専用端末アイテムを登録する (アイテムは ox_inventory に別途定義してください)
--- exports.cam_tablet:RegisterAppItem('racing_tablet', 'racing')
exports('RegisterAppItem', function(item, appId)
    return registerDeviceItem(item, appId, GetInvokingResource() or GetCurrentResourceName())
end)

exports('GetApps', function()
    local list = {}
    for i = 1, #CatalogOrder do list[i] = Catalog[CatalogOrder[i]] end
    return list
end)

-- 明示的に削除したアプリは、全プレイヤーのインストール済みからも消す
-- (同じIDで再登録した時に、必要アイテムなどの条件を通らずにインストール済み扱いにならないように)
-- ※ リソース停止による一時的な削除ではインストール済みのまま残す
local function purgeInstalls(appId)
    for cid, data in pairs(Cache) do
        local idx = contains(data.apps, appId)
        if idx then
            table.remove(data.apps, idx)
            persist(cid)
        end
    end
    CreateThread(function()
        while not dbReady do Wait(50) end
        local pattern = appId:gsub('[_%%\\]', '\\%0') -- JSON_SEARCH のワイルドカードをエスケープ
        local ok, err = pcall(MySQL.query.await,
            'UPDATE `cam_tablet` SET `apps` = JSON_REMOVE(`apps`, JSON_UNQUOTE(JSON_SEARCH(`apps`, \'one\', ?))) ' ..
            'WHERE JSON_VALID(`apps`) AND JSON_SEARCH(`apps`, \'one\', ?) IS NOT NULL',
            { pattern, pattern })
        if not ok then lib.print.error(('failed to purge installs of %s: %s'):format(appId, err)) end
        -- 掃除中に同じIDで再登録・再インストールされていた場合、UPDATE が後から消してしまうので
        -- ログイン中キャラクター (キャッシュが正) は書き戻す
        for cid, data in pairs(Cache) do
            if contains(data.apps, appId) then persist(cid) end
        end
    end)
end

exports('RemoveApp', function(appId)
    local ok = removeApp(appId)
    if ok then
        purgeInstalls(appId)
        catalogChanged()
    end
    return ok
end)

--- プレイヤーにアプリを付与 (条件チェック無し)
exports('InstallApp', function(src, appId)
    return installApp(src, appId, true).ok
end)

exports('UninstallApp', function(src, appId)
    local data, _, cid = getData(src)
    if not data then return false end
    local idx = contains(data.apps, appId)
    if not idx then return false end
    table.remove(data.apps, idx)
    persist(cid)
    return true
end)

exports('HasApp', function(src, appId)
    local data = getData(src)
    return data and contains(data.apps, appId) ~= nil or false
end)

exports('GetInstalledApps', function(src)
    local data = getData(src)
    return data and filterInstalled(data.apps) or {}
end)

--- タブレットに通知を送る
--- exports.cam_tablet:Notify(source, { title = 'タイトル', message = '本文', icon = 'fa-solid fa-bell', app = 'notes' })
exports('Notify', function(src, notification)
    TriggerClientEvent('cam_tablet:client:notify', src, notification)
end)

-- 外部リソースはこのイベントを受けてアプリを (再) 登録してください。
-- cam_tablet が再起動された場合も発火するので、登録が消えません。
CreateThread(function()
    Wait(0)
    TriggerEvent('cam_tablet:ready')
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then return end
    local changed = false
    for i = #CatalogOrder, 1, -1 do
        local app = Catalog[CatalogOrder[i]]
        if app.resource == resource then
            Catalog[app.id] = nil
            table.remove(CatalogOrder, i)
            changed = true
        end
    end
    for item, entry in pairs(DeviceItems) do
        if entry.resource == resource then
            DeviceItems[item] = nil
            changed = true -- 開いている専用端末の許可も取り直させる
        end
    end
    if changed then catalogChanged() end
end)
