local isOpen = false
local isOpening = false
local isStandalone = false
local openToken = 0 -- 開く処理の世代。閉じる/ログアウトで進め、待機中の古い open を無効にする
local sessionId = 0 -- 開いている1回分のセッション。ループや非同期処理は自分のセッションが続いている間だけ動く

local function alive(sid)
    return isOpen and sid == sessionId
end
local standaloneApp
local refreshCatalog -- 下で定義
local tabletProp

---------------------------------------------------------------------
-- Animation
---------------------------------------------------------------------

local function startAnimation(sid)
    local anim = Config.Animation
    if not anim.enabled then return end

    local ped = cache.ped
    lib.requestAnimDict(anim.dict)
    lib.requestModel(anim.prop)

    local coords = GetEntityCoords(ped)
    tabletProp = CreateObject(anim.prop, coords.x, coords.y, coords.z + 0.2, true, true, false)
    AttachEntityToEntity(tabletProp, ped, GetPedBoneIndex(ped, anim.bone),
        anim.offset.x, anim.offset.y, anim.offset.z,
        anim.rotation.x, anim.rotation.y, anim.rotation.z,
        true, true, false, true, 1, true)
    SetModelAsNoLongerNeeded(anim.prop)

    TaskPlayAnim(ped, anim.dict, anim.clip, 3.0, 3.0, -1, 49, 0, false, false, false)
    RemoveAnimDict(anim.dict)

    -- アニメーションが他の動作で途切れた場合に再生し直す
    CreateThread(function()
        while alive(sid) do
            if not IsEntityPlayingAnim(cache.ped, anim.dict, anim.clip, 3) and not IsPedInAnyVehicle(cache.ped, false) then
                lib.requestAnimDict(anim.dict)
                TaskPlayAnim(cache.ped, anim.dict, anim.clip, 3.0, 3.0, -1, 49, 0, false, false, false)
                RemoveAnimDict(anim.dict)
            end
            Wait(1000)
        end
    end)
end

local function stopAnimation()
    local anim = Config.Animation
    if not anim.enabled then return end

    StopAnimTask(cache.ped, anim.dict, anim.clip, 2.0)
    if tabletProp and DoesEntityExist(tabletProp) then
        DetachEntity(tabletProp, true, false)
        DeleteEntity(tabletProp)
    end
    tabletProp = nil
end

---------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------

local function getProfile()
    local pd = exports.qbx_core:GetPlayerData() or {}
    local ci = pd.charinfo or {}
    local job = pd.job or {}
    local gang = pd.gang or {}
    local money = pd.money or {}

    return {
        name = ('%s %s'):format(ci.firstname or '', ci.lastname or ''),
        firstname = ci.firstname,
        lastname = ci.lastname,
        citizenid = pd.citizenid,
        phone = ci.phone,
        birthdate = ci.birthdate,
        gender = ci.gender,
        nationality = ci.nationality,
        job = job.label,
        jobName = job.name,
        grade = job.grade and job.grade.name,
        onduty = job.onduty,
        gang = gang.name ~= 'none' and gang.label or nil,
        gangGrade = gang.name ~= 'none' and gang.grade and gang.grade.name or nil,
        cash = money.cash or 0,
        bank = money.bank or 0,
    }
end

local function groupKey()
    local pd = exports.qbx_core:GetPlayerData() or {}
    local job, gang = pd.job or {}, pd.gang or {}
    return ('%s:%s|%s:%s'):format(job.name, job.grade and job.grade.level, gang.name, gang.grade and gang.grade.level)
end

local function uiConfig()
    return {
        wallpapers = Config.Wallpapers,
        defaultWallpaper = Config.DefaultWallpaper,
        allowCustomWallpaper = Config.AllowCustomWallpaper,
        accentColors = Config.AccentColors,
        dockApps = Config.DockApps,
        download = Config.Download,
        storageMB = Config.StorageMB,
        appItemHome = Config.AppItemHome,
        limits = Config.Limits,
        guide = Config.Guide,
        serverName = GetConvar('sv_projectName', '') ~= '' and GetConvar('sv_projectName', '') or nil,
    }
end

local function canUseNow()
    if IsPauseMenuActive() then return false end
    if Config.BlockWhenDead then
        local state = LocalPlayer.state
        if IsEntityDead(cache.ped) or state.isDead or state.dead or state.isCuffed or state.handcuffed then
            return false
        end
    end
    return true
end

---------------------------------------------------------------------
-- Open / Close
---------------------------------------------------------------------

local function closeTablet(fromUi)
    openToken = openToken + 1
    if not isOpen then return end
    isOpen = false
    TriggerEvent('cam_tablet:client:closed')
    SetNuiFocus(false, false)
    if not fromUi then
        SendNUIMessage({ action = 'close' })
    end
    stopAnimation()
end

local function openTablet(appId, standalone)
    if isOpening then return end

    standalone = standalone == true and appId ~= nil

    if isOpen then
        if not standalone and not isStandalone then
            if appId then SendNUIMessage({ action = 'openApp', app = appId }) end
            return
        end
        -- 専用端末モードの切り替えは開き直す
        closeTablet(false)
    end

    if not canUseNow() then
        return lib.notify({ description = Config.Locale.cannotUse, type = 'error' })
    end

    isOpening = true
    openToken = openToken + 1
    local token = openToken
    local data = lib.callback.await('cam_tablet:server:getData', false, appId, standalone)
    isOpening = false

    -- 待っている間に Close() / ログアウトされたら開かない
    if token ~= openToken then return end

    if not data then
        return lib.notify({ description = Config.Locale.noTablet, type = 'error' })
    end

    -- 専用アイテムを持っていない場合 (OpenApp export など) は通常モード
    if standalone and not data.device then standalone = false end
    isStandalone = standalone
    standaloneApp = standalone and appId or nil

    data.profile = getProfile()
    data.config = uiConfig()
    data.openApp = appId
    data.standalone = standalone
    data.gameTime = { h = GetClockHours(), m = GetClockMinutes() }

    isOpen = true
    sessionId = sessionId + 1
    local sid = sessionId
    TriggerEvent('cam_tablet:client:opened')
    SendNUIMessage({ action = 'open', data = data })
    SetNuiFocus(true, true)
    startAnimation(sid)

    -- 素早く閉じて開き直しても古いループが残らないよう、各ループは自分のセッションの間だけ動く
    CreateThread(function()
        while alive(sid) do
            SendNUIMessage({ action = 'gameTime', data = { h = GetClockHours(), m = GetClockMinutes() } })
            Wait(2000)
        end
    end)

    -- 開いている間に職業/ギャング (グレード含む) が変わったら、アプリの自動インストール/削除を反映する
    -- QBCore 互換イベントには頼らず qbx_core の PlayerData を直接見る
    CreateThread(function()
        local last = groupKey()
        while alive(sid) do
            Wait(1000)
            local key = groupKey()
            if alive(sid) and key ~= last then
                last = key
                refreshCatalog()
            end
        end
    end)
end

RegisterNetEvent('cam_tablet:client:open', function(appId, standalone)
    openTablet(appId, standalone)
end)

RegisterNetEvent('cam_tablet:client:close', function()
    closeTablet(false)
end)

if Config.Command then
    RegisterCommand(Config.Command, function()
        if isOpen then closeTablet(false) else openTablet() end
    end, false)
end

if Config.Keybind then
    lib.addKeybind({
        name = 'cam_tablet',
        description = Config.Locale.keybind,
        defaultKey = Config.Keybind,
        onPressed = function()
            if isOpen then closeTablet(false) else openTablet() end
        end,
    })
end

---------------------------------------------------------------------
-- NUI callbacks
---------------------------------------------------------------------

RegisterNUICallback('close', function(_, cb)
    closeTablet(true)
    cb(true)
end)

local function proxy(nuiName, serverName, field)
    RegisterNUICallback(nuiName, function(body, cb)
        local value = body
        if field then value = body and body[field] end
        cb(lib.callback.await(serverName, false, value) or false)
    end)
end

proxy('install', 'cam_tablet:server:install', 'id')
proxy('uninstall', 'cam_tablet:server:uninstall', 'id')
proxy('reorder', 'cam_tablet:server:reorder', 'order')
proxy('saveSettings', 'cam_tablet:server:saveSettings', 'settings')
proxy('resetSettings', 'cam_tablet:server:resetSettings')
proxy('saveNotes', 'cam_tablet:server:saveNotes', 'notes')
proxy('saveEvents', 'cam_tablet:server:saveEvents', 'events')

RegisterNUICallback('refresh', function(_, cb)
    if isStandalone then return cb(false) end
    local data = lib.callback.await('cam_tablet:server:getData', false)
    if data then
        data.profile = getProfile()
    end
    cb(data or false)
end)

RegisterNUICallback('getProfile', function(_, cb)
    cb(getProfile())
end)

-- タブレットのタイマーなど、閉じている時にも知らせたい通知
RegisterNUICallback('gameNotify', function(body, cb)
    if type(body) == 'table' then
        lib.notify({ title = body.title, description = body.message, type = 'inform' })
    end
    cb(true)
end)

-- 外部 (iframe) アプリからのイベントを Lua に中継
-- AddEventHandler('cam_tablet:client:appEvent', function(appId, event, data) end)
-- 外部アプリが開かれた/閉じられた時のイベント
-- AddEventHandler('cam_tablet:client:appOpened', function(appId) end)
-- AddEventHandler('cam_tablet:client:appClosed', function(appId) end)
RegisterNUICallback('appOpened', function(body, cb)
    if type(body) == 'table' and type(body.app) == 'string' then
        TriggerEvent('cam_tablet:client:appOpened', body.app)
    end
    cb(true)
end)

RegisterNUICallback('appClosed', function(body, cb)
    if type(body) == 'table' and type(body.app) == 'string' then
        TriggerEvent('cam_tablet:client:appClosed', body.app)
    end
    cb(true)
end)

RegisterNUICallback('appEvent', function(body, cb)
    if type(body) == 'table' and type(body.app) == 'string' and type(body.event) == 'string' then
        TriggerEvent('cam_tablet:client:appEvent', body.app, body.event, body.data)
    end
    cb(true)
end)

---------------------------------------------------------------------
-- Events
---------------------------------------------------------------------

RegisterNetEvent('cam_tablet:client:notify', function(notification)
    if type(notification) ~= 'table' then return end
    SendNUIMessage({ action = 'notify', data = notification })
end)

function refreshCatalog()
    if not isOpen then return end
    local sid, standalone = sessionId, isStandalone
    -- 専用端末モードでは対象アプリを含むカタログを取り直す (消えていれば NUI 側で閉じる)
    local data = lib.callback.await('cam_tablet:server:getData', false, standaloneApp, standalone)
    -- 待っている間に閉じた / 別モードで開き直した場合、古い結果は捨てる
    if not alive(sid) then return end
    if standalone and (not data or not data.device) then data = { catalog = {}, installed = {} } end
    if data then
        SendNUIMessage({ action = 'catalog', data = { catalog = data.catalog, installed = data.installed, removed = data.removed, added = data.added } })
    end
end

RegisterNetEvent('cam_tablet:client:catalogChanged', refreshCatalog)

local function onUnload()
    closeTablet(false)
    SendNUIMessage({ action = 'reset' })
end

RegisterNetEvent('qbx_core:client:playerLoggedOut', onUnload)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if isOpen then
        SetNuiFocus(false, false)
        stopAnimation()
    end
end)

---------------------------------------------------------------------
-- Exports (client)
---------------------------------------------------------------------

exports('Open', function(appId) openTablet(appId) end)
exports('OpenApp', function(appId, standalone) openTablet(appId, standalone) end)
exports('Close', function() closeTablet(false) end)
exports('IsOpen', function() return isOpen end)
exports('IsStandalone', function() return isOpen and isStandalone end)

--- exports.cam_tablet:Notify({ title = 'タイトル', message = '本文', icon = 'fa-solid fa-bell' })
exports('Notify', function(notification)
    if type(notification) ~= 'table' then return end
    SendNUIMessage({ action = 'notify', data = notification })
end)

--- 外部 (iframe) アプリへデータを送る (iframe 側では window.addEventListener('message') で受信)
exports('SendAppMessage', function(appId, data)
    SendNUIMessage({ action = 'appMessage', app = appId, data = data })
end)
