fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'cam_tablet_example'
description 'cam_tablet に外部アプリを追加するサンプル'

shared_script '@ox_lib/init.lua'
client_script 'client.lua'
server_script 'server.lua'

files {
    'html/index.html',
}

dependency 'cam_tablet'
