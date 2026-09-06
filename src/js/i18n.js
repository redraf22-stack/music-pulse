// ===== ПЕРЕВОДЫ =====
const translations={ru:{settings_title:'⚙️ Настройки',settings_lang:'Язык / Language',settings_mic:'Микрофон (ввод)',settings_speaker:'Динамики (вывод)',settings_default:'По умолчанию',camera_label:'📷 Камера (видео)',room_code_label:'Код комнаты (кликни чтобы скопировать)',join_voice:'🎙️ Войти в войс чат',leave_voice:'📴 Выйти из войс чата',voice_chat_label:'Голосовой чат',voice_on:'ВКЛ',voice_off:'ВЫКЛ',cooldown_label:'Кулдаун (сек)',vote_time_label:'Время голоса (сек)',random_mode:'🎲 Режим рандома',participants_label:'Участники',nickname_ph:'Введите ваш никнейм',create_room:'Создать комнату',or_join:'или присоединиться',room_code_ph:'Код комнаты (5 цифр)',join_room:'Войти в комнату',search_ph:'Найти трек (#Скачанное название)...',queue_label:'🎶 Очередь',tracks_label:'треков',poll_title:'🗳️ Голосование',vote_for:'👍 За',vote_neutral:'😐 Всё равно',vote_against:'👎 Против',waiting:'Ожидание...',autoplay_blocked:'🔇 Браузер блокирует автовоспроизведение',click_to_enable:'🎧 Нажми, чтобы включить звук',copied:'Код скопирован!',voice_disabled:'Голосовой чат выключен',no_browser_support:'Браузер не поддерживает голосовой чат.',connecting:'⏳ Подключение...',connected:'Подключено к голосовому чату! 🎙️',error_prefix:'Ошибка: ',mic_denied:'Разрешите доступ к микрофону',mic_not_found:'Микрофон не найден',need_https:'Требуется HTTPS',admin_left:'Админ покинул комнату.',force_muted:'Админ замьючил вас',unmuted:'Админ снял мут',force_deafened:'Админ заглушил вас',undeafened:'Админ снял глушение',muted_by_admin:'Замьючен админом',self_muted:'Замьючил себя',mute_action:'Замютить',not_muted:'Не замьючен',deafened_by_admin:'Заглушен админом',self_deafened:'Заглушил себя',deafen_action:'Заглушить',not_deafened:'Не заглушен',vip_received:'VIP! ⭐',mod_received:'Модератор! 🛡️',roles_removed:'Роли сняты',no_local_tracks:'Нет скачанных треков 😔',nothing_found:'Ничего не найдено 😔',nothing_found_filter:'Ничего не найдено по «{filter}» 😔',search_error:'Ошибка поиска',page_of:'Стр. {cur} из {total}',back:'◀ Назад',forward:'Вперёд ▶',local_badge:'💾 Full',queue_empty:'Очередь пуста',poll_voting:'🗳️ Идет голосование...',play_now:'▶',next_queue:'⏭',end_queue:'⏬',reject:'❌',start_poll:'🗳️',vote_accepted:'Голос принят!',wait_seconds:'Подождите {n} сек.',suggested_by:'предложил:',total_votes:'Всего: {n}',kicked_msg:'Вас кикнули из комнаты',banned_msg:'Вы забанены в этой комнате 🚫',code_changed:'Код комнаты изменён!',confirm_kick_title:'Кикнуть пользователя?',confirm_kick_msg:'Пользователь будет удалён из комнаты.',confirm_ban_title:'Забанить пользователя?',confirm_ban_msg:'Пользователь будет заблокирован по IP и не сможет зайти в эту комнату.',confirm_regen_title:'Новый код комнаты?',confirm_regen_msg:'Текущий код станет недействительным. Все участники останутся.',btn_confirm:'Да',btn_cancel:'Отмена',btn_ok:'OK',err_title:'Ошибка',subtitle:'Синхронное прослушивание музыки',local_rooms:'Комнаты в локальной сети',searching_servers:'Поиск комнат...',no_servers:'Комнаты не найдены',direct_connect:'Прямое подключение (IP:код)',connect_btn:'Подключить',https_label:'Использовать HTTPS',create_server:'🚀 Создать свой сервер',enter_ip:'Введите адрес IP:код',leave_room:'Выйти из комнаты',leave_room_title:'Выход',leave_admin_confirm:'Вы админ — при выходе комната будет закрыта для всех участников. Выйти?',leave_user_confirm:'Выйти из комнаты?',boot_error:'Не удалось войти в комнату',lan_on:'📡 Видна в локальной сети',lan_off:'📡 Скрыта (вход по коду)',lan_admin_only:'Только админ может менять видимость',playlist_label:'Плейлист',playlist_classic:'Классический',playlist_settings:'Настройки плейлиста',playlist_name:'Название',playlist_new:'Новый плейлист',playlist_delete:'Удалить плейлист',playlist_delete_confirm:'Плейлист «{name}» будет удалён.',playlist_create:'Создать плейлист',playlist_add_tracks:'Добавить треки',playlist_users:'Участники',playlist_tracks:'Треки',playlist_downloaded:'СКАЧАННЫЕ',playlist_url:'URL',playlist_shared:'💾 СКАЧАННЫЕ У УЧАСТНИКА',playlist_search:'Поиск по названию...',playlist_request_share:'📤 Запросить шаринг музыки',playlist_share_requested:'📤 Запрос отправлен: {name}',playlist_shared_count:'📤 Музыка в комнате: {n} треков',playlist_share_failed:'📤 Не удалось поднять сервер музыки',playlist_share_error:'📤 Ошибка шаринга: {msg}',playlist_all_tracks:'Все его треки',url_track_title:'➕ Трек по URL',url_track_name:'Название песни *',url_track_artist:'Исполнитель',url_track_album:'Альбом',url_track_link:'Ссылка на трек *',url_track_link_ph:'MP3/WAV/OGG • deezer.com/track/…',url_track_auto_cover:'Авто-обложка (как у скачанных)',url_track_copyright:'Добавляя ссылку, вы подтверждаете, что имеете права на этот контент.',url_track_saved:'🔗 Трек сохранён!',url_track_check:'⏳ Проверяю ссылку...',url_track_check_failed:'Не удалось распознать ссылку',url_track_check_error:'Ошибка проверки ссылки',url_track_invalid:'Вставь ссылку (https://...)',music_folder_label:'📁 Папка с музыкой',music_folder_pick:'Выбрать',music_folder_hint:'Где хранятся твои MP3/WAV/OGG файлы',music_folder_saved:'📁 Папка сохранена',music_folder_error:'Ошибка сохранения',connection_good:'● {ms} ms',connection_warn:'⏳ {ms} ms',connection_bad:'⚠ {ms} ms',connection_lost:'⚠ Нет соединения',connection_lost_toast:'⚠ Потеряно соединение с сервером. Обложки и онлайн-функции не работают.',connection_restored:'Соединение восстановлено',tech_settings:'⚡ Технические настройки',vote_settings:'⚡ Настройки голосования',no_internet:'Нет интернета',no_internet_toast:'⚠ Нет интернета — обложки и поиск Deezer недоступны',internet_restored:'Интернет восстановлен',},en:{settings_title:'⚙️ Settings',settings_lang:'Language / Язык',settings_mic:'Microphone (input)',settings_speaker:'Speakers (output)',settings_default:'Default',camera_label:'📷 Camera (video)',room_code_label:'Room code (click to copy)',join_voice:'🎙️ Join voice chat',leave_voice:'📴 Leave voice chat',voice_chat_label:'Voice chat',voice_on:'ON',voice_off:'OFF',cooldown_label:'Cooldown (sec)',vote_time_label:'Vote time (sec)',random_mode:'🎲 Random mode',participants_label:'Participants',nickname_ph:'Enter your nickname',create_room:'Create room',or_join:'or join',room_code_ph:'Room code (5 digits)',join_room:'Join room',search_ph:'Search track (#Downloaded name)...',queue_label:'🎶 Queue',tracks_label:'tracks',poll_title:'🗳️ Voting',vote_for:'👍 For',vote_neutral:'😐 Neutral',vote_against:'👎 Against',waiting:'Waiting...',autoplay_blocked:'🔇 Browser blocked autoplay',click_to_enable:'🎧 Click to enable audio',copied:'Copied!',voice_disabled:'Voice disabled',no_browser_support:'No voice support',connecting:'⏳ Connecting...',connected:'Connected to voice chat! 🎙️',error_prefix:'Error: ',mic_denied:'Allow microphone access',mic_not_found:'Microphone not found',need_https:'HTTPS required',admin_left:'Admin left the room.',force_muted:'Admin muted you',unmuted:'Admin unmuted you',force_deafened:'Admin deafened you',undeafened:'Admin undeafened you',muted_by_admin:'Muted by admin',self_muted:'Self muted',mute_action:'Mute',not_muted:'Not muted',deafened_by_admin:'Deafened by admin',self_deafened:'Self deafened',deafen_action:'Deafen',not_deafened:'Not deafened',vip_received:'VIP! ⭐',mod_received:'Moderator! 🛡️',roles_removed:'Roles removed',no_local_tracks:'No downloaded tracks 😔',nothing_found:'Nothing found 😔',nothing_found_filter:'Nothing found for "{filter}" 😔',search_error:'Search error',page_of:'Page {cur} of {total}',back:'◀ Back',forward:'Next ▶',local_badge:'💾 Full',queue_empty:'Queue is empty',poll_voting:'🗳️ Voting in progress...',play_now:'▶',next_queue:'⏭',end_queue:'⏬',reject:'❌',start_poll:'🗳️',vote_accepted:'Vote accepted!',wait_seconds:'Wait {n} sec.',suggested_by:'suggested by:',total_votes:'Total: {n}',kicked_msg:'You were kicked from the room',banned_msg:'You are banned from this room 🚫',code_changed:'Room code changed!',confirm_kick_title:'Kick user?',confirm_kick_msg:'The user will be removed from the room.',confirm_ban_title:'Ban user?',confirm_ban_msg:'The user will be blocked by IP and cannot rejoin this room.',confirm_regen_title:'New room code?',confirm_regen_msg:'Current code will become invalid. All participants will stay.',btn_confirm:'Yes',btn_cancel:'Cancel',btn_ok:'OK',err_title:'Error',subtitle:'Synchronized music listening',local_rooms:'Rooms in local network',searching_servers:'Searching rooms...',no_servers:'No rooms found',direct_connect:'Direct connect (IP:code)',connect_btn:'Connect',https_label:'Use HTTPS',create_server:'🚀 Create your server',enter_ip:'Enter IP:code',leave_room:'Leave room',leave_room_title:'Leave',leave_admin_confirm:'You are the admin — leaving will close the room for everyone. Leave?',leave_user_confirm:'Leave the room?',boot_error:'Failed to join the room',lan_on:'📡 Visible in LAN',lan_off:'📡 Hidden (join by code)',lan_admin_only:'Only admin can change visibility',playlist_label:'Playlist',playlist_classic:'Classic',playlist_settings:'Playlist settings',playlist_name:'Name',playlist_new:'New playlist',playlist_delete:'Delete playlist',playlist_delete_confirm:'Playlist "{name}" will be deleted.',playlist_create:'Create playlist',playlist_add_tracks:'Add tracks',playlist_users:'Users',playlist_tracks:'Tracks',playlist_downloaded:'DOWNLOADED',playlist_url:'URL',playlist_shared:'💾 USER\'S DOWNLOADED',playlist_search:'Search by name...',playlist_request_share:'📤 Request music share',playlist_share_requested:'📤 Request sent: {name}',playlist_shared_count:'📤 Music in room: {n} tracks',playlist_share_failed:'📤 Failed to start music server',playlist_share_error:'📤 Share error: {msg}',playlist_all_tracks:'All his tracks',url_track_title:'➕ Track by URL',url_track_name:'Song name *',url_track_artist:'Artist',url_track_album:'Album',url_track_link:'Track link *',url_track_link_ph:'MP3/WAV/OGG • deezer.com/track/…',url_track_auto_cover:'Auto cover (like downloaded)',url_track_copyright:'By adding a link, you confirm that you have the rights to this content.',url_track_saved:'🔗 Track saved!',url_track_check:'⏳ Checking link...',url_track_check_failed:'Failed to recognize link',url_track_check_error:'Link check error',url_track_invalid:'Paste a link (https://...)',music_folder_label:'📁 Music folder',music_folder_pick:'Choose',music_folder_hint:'Where your MP3/WAV/OGG files are stored',music_folder_saved:'📁 Folder saved',music_folder_error:'Save error',connection_good:'● {ms} ms',connection_warn:'⏳ {ms} ms',connection_bad:'⚠ {ms} ms',connection_lost:'⚠ No connection',connection_lost_toast:'⚠ Connection to server lost. Covers and online features are unavailable.',connection_restored:'Connection restored',tech_settings:'⚡ Technical settings',vote_settings:'⚡ Voting settings',no_internet:'No internet',no_internet_toast:'⚠ No internet — covers and Deezer search unavailable',internet_restored:'Internet restored',}};
const _urlLang=new URLSearchParams(window.location.search).get('lang');
if(_urlLang)localStorage.setItem('syncmusic_lang',_urlLang);
let currentLang=_urlLang||localStorage.getItem('syncmusic_lang')||'ru';
function translate(key,params){let str=translations[currentLang]?.[key]||translations['ru']?.[key]||key;if(params)Object.keys(params).forEach(function(k){str=str.replace('{'+k+'}',params[k]);});return str;}
function setLanguage(l){currentLang=l;localStorage.setItem('syncmusic_lang',l);applyTranslations();}
function applyTranslations(){
document.querySelectorAll('[data-i18n]').forEach(function(el){el.textContent=translate(el.getAttribute('data-i18n'));});
document.querySelectorAll('[data-i18n-ph]').forEach(function(el){el.placeholder=translate(el.getAttribute('data-i18n-ph'));});

const lr=document.getElementById('lang-ru'),le=document.getElementById('lang-en');
if(lr)lr.classList.toggle('active',currentLang==='ru');
if(le)le.classList.toggle('active',currentLang==='en');
if(typeof updateVoiceToggleButton==='function')updateVoiceToggleButton();
if(typeof updateVoiceEntryButton==='function')updateVoiceEntryButton();
if(typeof updateRandomButtonVisibility==='function')updateRandomButtonVisibility();
if(typeof updateLanButton==='function')updateLanButton();
if(typeof renderPlaylistBar==='function'){try{renderPlaylistBar();}catch(e){}}
}
// ===== АВТОПЕРЕВОД ВСЕГО ПРИЛОЖЕНИЯ (один файл!) =====
// Чтобы добавить/поправить перевод — просто допиши строку 'русский':'english' сюда:
const AUTO_EXTRA={
'📹 Видеосвязь включена':'📹 Video enabled','📺 Трансляция экрана включена':'📺 Screen sharing enabled',
'📷 Включить видеосвязь':'📷 Enable video','📷 Выключить видеосвязь':'📷 Disable video',
'📺 Транслировать экран':'📺 Share screen','📺 Остановить трансляцию':'📺 Stop sharing',
'Нет участников с медиа':'No users with media','Участники с медиа':'Users with media',
'💬 Чат комнаты':'💬 Room chat','Сообщение...':'Message...','Полный экран':'Fullscreen','Закрыть':'Close',
'Прикрепить файл':'Attach file','Эмодзи':'Emoji','Отправить':'Send',
'📷 Фото':'📷 Photo','🎬 Видео':'🎬 Video','🎵 Аудио':'🎵 Audio','📄 Файл':'📄 File',
'СКАЧАННЫЕ':'DOWNLOADED','📤 Запросить шаринг музыки':'📤 Request music share',
'Ошибка загрузки треков':'Failed to load tracks','Пользователь не в голосовом чате':'User is not in voice chat',
'(Вы)':'(You)','Ваш экран':'Your screen','Админ':'Admin','Модератор':'Moderator','Участник':'Member',
' • Видео + Экран':' • Video + Screen',' • Видео':' • Video',' • Экран':' • Screen',
'Вставь ссылку (https://...)':'Paste a link (https://...)','⏳ Проверяю ссылку...':'⏳ Checking link...',
'Ошибка проверки ссылки':'Link check error','Не удалось распознать ссылку':'Failed to recognize link',
'🔗 Трек сохранён!':'🔗 Track saved!','Ошибка сохранения':'Save error','Ошибка загрузки обложки':'Cover upload error',
'Сохранить':'Save','Отмена':'Cancel','Удалить':'Delete','Название':'Name','Исполнитель':'Artist','Альбом':'Album',
'Ссылка на трек *':'Track link *','Название песни *':'Song name *','➕ Трек по URL':'➕ Track by URL',
'Авто-обложка (как у скачанных)':'Auto cover (like downloaded)',
'Добавляя ссылку, вы подтверждаете, что имеете права на этот контент.':'By adding a link, you confirm you have rights to this content.',
'🎼 Настройки плейлиста':'🎼 Playlist settings','Плейлист':'Playlist','Предыдущий':'Previous','Следующий':'Next',
'Новый плейлист':'New playlist','Настройки':'Settings','Выбрать этот плейлист':'Select this playlist',
'Поиск по названию...':'Search by name...','Участники (галочка = все его треки, 2×клик = список)':'Users (check = all their tracks, 2×click = list)',
'📁 Папка с музыкой':'📁 Music folder','Выбрать':'Choose','📁 Папка сохранена':'📁 Folder saved',
'Удалить плейлист?':'Delete playlist?','Классический':'Classic','Очередь пуста':'Queue is empty',
'Сейчас играет':'Now playing','Предыдущая':'Previous','треков':'tracks','Голосовой чат':'Voice chat',
'Режим рандома':'Random mode','Участники':'Participants','Код комнаты (кликни чтобы скопировать)':'Room code (click to copy)',
'📡 Скрыта (вход по коду)':'📡 Hidden (join by code)','📡 Видна в локальной сети':'📡 Visible in LAN',
'Войти в войс чат':'Join voice chat','🎙️ Войти в войс чат':'🎙️ Join voice chat','📴 Выйти из войс чата':'📴 Leave voice chat',
'Кулдаун (сек)':'Cooldown (sec)','Время голоса (сек)':'Vote time (sec)','По умолчанию':'Default',
'⚙️ Настройки':'⚙️ Settings','Язык / Language':'Language / Язык','Микрофон (ввод)':'Microphone (input)',
'Динамики (вывод)':'Speakers (output)','📷 Камера (видео)':'📷 Camera (video)',
'Создать комнату':'Create room','или присоединиться':'or join','Код комнаты (5 цифр)':'Room code (5 digits)',
'Войти в комнату':'Join room','Введите ваш никнейм':'Enter your nickname','🚀 Создать свой сервер':'🚀 Create your server',
'Прямое подключение (IP:код)':'Direct connect (IP:code)','Подключить':'Connect','Использовать HTTPS':'Use HTTPS',
'Комнаты в локальной сети':'Rooms in local network','Поиск комнат...':'Searching rooms...','Комнаты не найдены':'No rooms found',
'Введите адрес IP:код':'Enter IP:code','Синхронное прослушивание музыки':'Synchronized music listening',
'Где хранятся твои MP3/WAV/OGG файлы':'Where your MP3/WAV/OGG files live','📤 Не удалось поднять сервер музыки':'📤 Failed to start music server',
'⚠ Потеряно соединение с сервером. Обложки и онлайн-функции не работают.':'⚠ Server connection lost. Covers and online features unavailable.',
'Хост вышел из комнаты или сервер недоступен.':'Host left the room or server is unavailable.','Связь потеряна':'Connection lost',
'Комната закрыта':'Room closed','Админ покинул комнату.':'Admin left the room.','Вас кикнули из комнаты':'You were kicked from the room',
'Вы забанены в этой комнате 🚫':'You are banned from this room 🚫','Код комнаты изменён!':'Room code changed!',
'Код скопирован!':'Copied!','Голос принят!':'Vote accepted!','🗳️ Идет голосование...':'🗳️ Voting in progress...',
'предложил:':'suggested by:','Ожидание...':'Waiting...','🔇 Браузер блокирует автовоспроизведение':'🔇 Browser blocked autoplay',
'🎧 Нажми, чтобы включить звук':'🎧 Click to enable audio','⏳ Подключение...':'⏳ Connecting...',
'Подключено к голосовому чату! 🎙️':'Connected to voice chat! 🎙️','Голосовой чат выключен':'Voice chat is disabled',
'Разрешите доступ к микрофону':'Allow microphone access','Микрофон не найден':'Microphone not found','Требуется HTTPS':'HTTPS required',
'Нет скачанных треков 😔':'No downloaded tracks 😔','Ничего не найдено 😔':'Nothing found 😔','Ошибка поиска':'Search error',
'◀ Назад':'◀ Back','Вперёд ▶':'Next ▶','💾 Full':'💾 Full','🎶 Очередь':'🎶 Queue',
'Найти трек (#Скачанное название)...':'Find track (#Downloaded name)...','🎲 Режим рандома':'🎲 Random mode',
'Только админ может менять видимость':'Only admin can change visibility','Вы админ — при выходе комната будет закрыта для всех участников. Выйти?':'You are the admin — leaving closes the room for everyone. Leave?',
'Выйти из комнаты?':'Leave the room?','Выход':'Leave','Не удалось войти в комнату':'Failed to join the room',
'VIP! ⭐':'VIP! ⭐','Модератор! 🛡️':'Moderator! 🛡️','Роли сняты':'Roles removed',
'Замьючен админом':'Muted by admin','Замьючил себя':'Self muted','Замютить':'Mute','Не замьючен':'Not muted',
'Заглушен админом':'Deafened by admin','Заглушил себя':'Self deafened','Заглушить':'Deafen','Не заглушен':'Not deafened',
'Админ замьючил вас':'Admin muted you','Админ снял мут':'Admin unmuted you','Админ заглушил вас':'Admin deafened you','Админ снял глушение':'Admin undeafened you',
'👍 За':'👍 For','😐 Всё равно':'😐 Neutral','👎 Против':'👎 Against','🗳️ Голосование':'🗳️ Voting',
'Скрыта (вход по коду)':'Hidden (join by code)','Видна в локальной сети':'Visible in LAN','Нет соединения':'No connection','⚡ Технические настройки':'⚡ Technical settings','⚡ Настройки голосования':'⚡ Voting settings',
};
const PREFIX_RULES=[['Треки: ','Tracks: '],['📤 Запрос отправлен: ','📤 Request sent: '],['📤 Музыка в комнате: ','📤 Music in room: '],['📤 Ошибка шаринга: ','📤 Share error: '],['Не удалось включить камеру: ','Failed to enable camera: '],['Не удалось начать трансляцию: ','Failed to start sharing: '],['Плейлист «','Playlist "'],['Ничего не найдено по «','Nothing found for "'],['Подождите ','Wait ']];
const SUFFIX_RULES=[[' треков',' tracks'],[' трека',' tracks'],[' сек.',' sec.'],[' сек',' sec'],['» будет удалён.','" will be deleted.'],['» 😔','" 😔']];
const REGEX_RULES=[[/Стр\. (\d+) из (\d+)/,'Page $1 of $2'],[/Всего: (\d+)/,'Total: $1'],[/Подождите (\d+) сек\./,'Wait $1 sec.']];
let autoMap=null;
function buildAutoMap(){const m={};const ru=translations.ru,en=translations.en;Object.keys(ru).forEach(k=>{if(en[k]&&typeof ru[k]==='string'&&ru[k].indexOf('{')<0)m[ru[k]]=en[k];});Object.keys(AUTO_EXTRA).forEach(k=>{m[k]=AUTO_EXTRA[k];});return m;}
function trText(t){
if(currentLang!=='en'||!t)return t;
if(!autoMap)autoMap=buildAutoMap();
const s=t.trim();if(!s)return t;
if(autoMap[s])return t.replace(s,autoMap[s]);
for(const rr of REGEX_RULES){if(rr[0].test(s))return t.replace(rr[0],rr[1]);}
for(const pr of PREFIX_RULES){
if(s.indexOf(pr[0])===0){
let rest=s.slice(pr[0].length);
for(const sr of SUFFIX_RULES){if(rest.length>sr[0].length&&rest.slice(-sr[0].length)===sr[0]){rest=rest.slice(0,-sr[0].length)+sr[1];break;}}
return t.replace(s,pr[1]+rest);
}
}
return t;
}
function translateAll(root){
if(currentLang!=='en'||!root)return;
if(!autoMap)autoMap=buildAutoMap();
const walk=n=>{
if(n.nodeType===3){const nt=trText(n.textContent);if(nt!==n.textContent)n.textContent=nt;return;}
if(n.nodeType!==1)return;
const tag=n.tagName;if(tag==='SCRIPT'||tag==='STYLE')return;
if(n.getAttribute){['title','placeholder'].forEach(a=>{const v=n.getAttribute(a);if(v){const nt=trText(v);if(nt!==v)n.setAttribute(a,nt);}});}
if(n.childNodes)n.childNodes.forEach(walk);
};
walk(root);
}
new MutationObserver(muts=>{
if(currentLang!=='en')return;
muts.forEach(m=>{
if(m.type==='characterData'){const nt=trText(m.target.textContent);if(nt!==m.target.textContent)m.target.textContent=nt;return;}
if(m.type==='attributes'&&m.target&&m.target.getAttribute){const v=m.target.getAttribute(m.attributeName);if(v){const nt=trText(v);if(nt!==v)m.target.setAttribute(m.attributeName,nt);}return;}
m.addedNodes.forEach(n=>{if(n.nodeType===1)translateAll(n);else if(n.nodeType===3){const nt=trText(n.textContent);if(nt!==n.textContent)n.textContent=nt;}});
});
}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder']});
const _origSetLanguage=setLanguage;
setLanguage=function(l){autoMap=null;_origSetLanguage(l);setTimeout(()=>translateAll(document.body),50);};
translateAll(document.body);