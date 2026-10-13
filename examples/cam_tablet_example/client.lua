local APP = 'example_app'

-- iframe から CamTablet.post('getInfo') で呼ばれる (自分のリソースの NUI コールバック)
RegisterNUICallback('getInfo', function(_, cb)
    cb(lib.callback.await('cam_tablet_example:server:getInfo', false))
end)

-- iframe から CamTablet.emit(event, data) で送られたイベント
AddEventHandler('cam_tablet:client:appEvent', function(appId, event, data)
    if appId ~= APP then return end

    if event == 'getCoords' then
        local c = GetEntityCoords(cache.ped)
        -- Lua -> iframe (iframe 側では CamTablet.on('message', fn) で受信)
        exports.cam_tablet:SendAppMessage(APP, {
            type = 'coords',
            x = math.floor(c.x * 10) / 10,
            y = math.floor(c.y * 10) / 10,
            z = math.floor(c.z * 10) / 10,
            street = GetStreetNameFromHashKey(GetStreetNameAtCoord(c.x, c.y, c.z)),
        })
    elseif event == 'waypoint' and type(data) == 'table' then
        SetNewWaypoint(data.x + 0.0, data.y + 0.0)
        lib.notify({ description = 'ウェイポイントを設定しました' })
    end
end)

AddEventHandler('cam_tablet:client:appOpened', function(appId)
    if appId == APP then print('[example] app opened') end
end)

AddEventHandler('cam_tablet:client:appClosed', function(appId)
    if appId == APP then print('[example] app closed') end
end)

-- 例: タブレットを開いて直接このアプリを起動
-- exports.cam_tablet:OpenApp(APP)
