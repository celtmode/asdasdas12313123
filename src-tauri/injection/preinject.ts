import { badPostMessagePatch, proxyFetch, proxyXHR, proxyAddEventListener, proxyOpen, proxyNotification } from './shared/recreate'
import { extraCssChangeWatch, safemodeTimer, typingAnim } from './shared/ui'
import { cssSanitize, fetchImage, isJson, waitForApp, waitForDom, waitForElm, saferEval, timeout } from './shared/util'
import { waitForElmEx } from './shared/wait_elm'
import { configureDisplayMedia } from './shared/display_media'

// Let's expose some stuff for use in plugins and such
window.ParsCord = {
  util: {
    cssSanitize,
    isJson,
    fetchImage,
    waitForApp,
    waitForElm,
    waitForElmEx,
  },
  shouldShowUnreadBadge: false
};
window.Dorion = window.ParsCord

(async () => {
  // if we are in an iframe we don't really need to load anything, else we bork whatever is inside
  if (window.self !== window.top) {
    // fixes activities
    console.log('Patching postMessage...')
    badPostMessagePatch()

    console.log('Stopping here, we are in an iframe!')
    return
  }

  configureDisplayMedia()
  proxyXHR()
  proxyAddEventListener()
  proxyNotification()

  while (!window.__TAURI__) {
    console.log('Waiting for definition...')
    await timeout(50)
  }

  window.__TAURI__.event.emit('js_context_loaded', null)

  proxyFetch()

  console.log('__TAURI__ defined!')

  extraCssChangeWatch()
  proxyOpen()

  const platform = await window.__TAURI__.core.invoke('get_platform')
  document.documentElement.setAttribute('data-dorion-platform', platform)

  const { invoke } = window.__TAURI__.core
  const config = await invoke('read_config_file')

  window.__DORION_CONFIG__ = isJson(config) ? JSON.parse(config) : {}

  // Recreate config if there is an issue
  if (!Object.keys(config).length || !config) {
    const defaultConf = await invoke('default_config')
    // Write
    await invoke('write_config_file', {
      config: defaultConf
    })

    window.__DORION_CONFIG__ = JSON.parse(defaultConf)
  }

  const debug = !window.__DORION_CONFIG__.client_plugins
  console.log(window.__DORION_CONFIG__)
  const INJECTED_PLUGIN_OPTIONS = {
    isVisible: true,
    allowedActions: { toggle: debug },
    loaderName: 'ParsCord'
  }

  window.SHELTER_INJECTOR_PLUGINS = {
    'Antitrack': ['https://yellowsink.github.io/shelter-plugins/antitrack/', {
      ...INJECTED_PLUGIN_OPTIONS,
      allowedActions: {
        toggle: true,
      }
    }],
    'ParsCord Titlebar': ['https://spikehd.dev/shelter-plugins/dorion-titlebar/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord Settings': ['https://spikehd.dev/shelter-plugins/dorion-settings/', INJECTED_PLUGIN_OPTIONS],
    'Always Trust': ['https://spikehd.dev/shelter-plugins/always-trust/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord Notifications': ['https://spikehd.dev/shelter-plugins/dorion-notifications/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord Streamer Mode': ['https://spikehd.dev/shelter-plugins/dorion-streamer-mode/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord Updater': ['https://spikehd.dev/shelter-plugins/dorion-updater/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord PTT': ['https://spikehd.dev/shelter-plugins/dorion-ptt/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord Tray': ['https://spikehd.dev/shelter-plugins/dorion-tray/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord Fullscreen': ['https://spikehd.dev/shelter-plugins/dorion-fullscreen/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord Custom Keybinds': ['https://spikehd.dev/shelter-plugins/dorion-custom-keybinds/', INJECTED_PLUGIN_OPTIONS],
    'ParsCord Helpers': ['https://spikehd.dev/shelter-plugins/dorion-helpers/', INJECTED_PLUGIN_OPTIONS],
    'Web Keybinds': ['https://spikehd.dev/shelter-plugins/web-keybinds/', {
      ...INJECTED_PLUGIN_OPTIONS,
      allowedActions: {
        toggle: true,
      }
    }],
  }

  init()
})()

async function init() {
  const { event, app } = window.__TAURI__
  const { invoke } = window.__TAURI__.core

  // Show the boot screen before any network work (loading client mods,
  // themes and plugins can take several seconds). The window is already
  // visible by then, so waiting would leave the user staring at black.
  try {
    await waitForDom()

    if (await shouldShowSplash()) await displayLoadingTop()
  } catch (e) {
    console.error('Failed to show the loading screen', e)
  }

  safemodeTimer(
    document.querySelector('#safemode') as HTMLDivElement
  )
  typingAnim()
  updateOverlay({
    midtitle: 'Localizing JS imports...'
  })
  startProgressTimeline()

  const config = await invoke('read_config_file')

  window.__DORION_CONFIG__ = isJson(config) ? JSON.parse(config) : {}

  // Recreate config if there is an issue
  if (!Object.keys(config).length || !config) {
    const defaultConf = await invoke('default_config')
    // Write
    await invoke('write_config_file', {
      config: defaultConf
    })

    window.__DORION_CONFIG__ = JSON.parse(defaultConf)
  }

  window.ParsCord.shouldShowUnreadBadge = window.__DORION_CONFIG__.unread_badge

  await invoke('load_plugins')

  const version = await app.getVersion()

  const versionLabel = document.getElementById('releaseVersion')
  if (versionLabel) versionLabel.textContent = `v${version}`

  // Discord Web depends on the `beforeunload` event being dispatched by the browser when
  // a tab is closed. However, this event is not triggered by the Webview so we need to
  // dispatch the `beforeunload` event ourselves.
  const dispatchBeforeUnload = () => {
    const event = new Event('beforeunload') as Event & { isTrustedOverwrite: boolean }
    event.isTrustedOverwrite = true
    window.dispatchEvent(event)
  }

  event.listen('beforeunload', dispatchBeforeUnload)
  event.listen(event.TauriEvent.WINDOW_CLOSE_REQUESTED, dispatchBeforeUnload)

  // Start the loading_log event listener
  const logUnlisten = await event.listen('loading_log', (event: TauriEvent) => {
    const log = event.payload as string

    updateOverlay({
      logs: log
    })
  })

  let themeJs = await handleClientModThemeInjection()
  themeJs += await handleThemeInjection()

  updateOverlay({
    midtitle: 'Getting injection JS...'
  })

  const injectionJs = await invoke('get_injection_js', {
    themeJs,
  })

  saferEval(injectionJs)

  updateOverlay({
    midtitle: 'Done!'
  })

  // Keep the splash visible until Discord has rendered its login or main interface.
  const loadingContainer = document.querySelector('#loadingContainer') as HTMLDivElement | null
  if (!loadingContainer) {
    logUnlisten()
    return
  }
  updateOverlay({ midtitle: 'Waiting for Discord...' })
  await waitForDiscordReady(loadingContainer)
  if (!loadingContainer.isConnected) {
    logUnlisten()
    return
  }

  // Keep the rail filling for its full ten seconds even if Discord shows up
  // early, then finish it once the real interface is on screen.
  await waitForTimeline()
  if (!loadingContainer.isConnected) {
    logUnlisten()
    return
  }

  setProgress(100, 'Ready')
  updateOverlay({ midtitle: 'Ready', logs: 'Interface ready - opening Discord...' })
  await timeout(500)
  loadingContainer.classList.add('is-ready')
  document.getElementById('safemode')?.classList.remove('show')

  // Hand the screen over from the native splash to the loaded Discord window.
  void invoke('finish_splash').catch(() => {})

  let dismissed = false

  function onKeydown(evt: KeyboardEvent) {
    if (evt.code === 'Enter' || evt.code === 'NumpadEnter' || evt.code === 'Space') dismiss()
  }

  function dismiss() {
    document.removeEventListener('keydown', onKeydown)

    if (dismissed) return
    dismissed = true

    void invoke('finish_splash').catch(() => {})

    logUnlisten()

    const el = loadingContainer

    if (!el || !el.isConnected) return

    el.classList.add('is-leaving')
    window.setTimeout(() => el.remove(), 720)
  }

  const enterButton = document.querySelector('#enterDiscord') as HTMLButtonElement | null
  enterButton?.addEventListener('click', dismiss)
  document.addEventListener('keydown', onKeydown)

  // Discord is already behind the splash: reveal it shortly after the bar
  // finishes, and keep Enter/click as a way to skip the last beat.
  window.setTimeout(dismiss, 2000)
}

/** Smoothed progress and the label currently being shown. */
let currentProgress = 6
let currentStatus = 'Connecting to Discord...'
let timelineDone = false
const timelineWaiters: Array<() => void> = []

/** Small, human caption shown underneath the progress rail. */
function captionFor(progress: number, status: string) {
  const captions: Record<string, string> = {
    'Localizing JS imports...': 'Warming up the JavaScript core',
    'Loading client mod theme CSS...': 'Fusing client mod styles',
    'Loading theme CSS...': 'Spreading a fresh coat of frost',
    'Localizing CSS imports...': 'Frosting the interface',
    'Getting injection JS...': 'Assembling the ice core',
    'Done!': 'Interface frozen in place',
    'Waiting for Discord...': 'Handshaking with the gateway',
    'Ready': 'All systems nominal',
  }

  if (captions[status]) return captions[status]
  if (progress >= 100) return 'All systems nominal'
  if (progress >= 92) return 'Handshaking with the gateway'
  if (progress >= 68) return 'Frosting the interface'
  if (progress >= 36) return 'Applying your setup'
  return 'Preparing cryo chamber'
}

/**
 * Push a progress value into every part of the splash that displays it.
 * Every lookup is optional so the app still boots if the markup changes.
 */
function setProgress(progress: number, status: string = currentStatus) {
  const progressFill = document.getElementById('progressFill')
  const progressTrack = document.getElementById('progressTrack')
  const progressValue = document.getElementById('progressValue')
  const container = document.getElementById('pc-root')
  const note = document.getElementById('startLabel')
  const value = Math.max(0, Math.min(100, progress))

  currentProgress = value

  if (progressFill) progressFill.style.width = `${value}%`

  if (progressTrack) {
    progressTrack.setAttribute('aria-valuenow', String(Math.round(value)))
    progressTrack.setAttribute('aria-valuetext', `${Math.round(value)}% - ${status || 'Loading'}`)
  }

  if (progressValue) progressValue.textContent = `${Math.floor(value)}%`
  if (container) container.style.setProperty('--pc-progress', String(value))
  if (note) note.textContent = captionFor(value, status)

  updateLoadingState(value, status)
}

/** Change the stage label without moving the progress rail. */
function setStatus(status: string) {
  currentStatus = status

  const midtitle = document.getElementById('midtitle')
  const note = document.getElementById('startLabel')

  if (midtitle) midtitle.textContent = status
  if (note) note.textContent = captionFor(currentProgress, status)

  updateLoadingState(currentProgress, status)
}

/**
 * Fill the rail over ten seconds while Discord boots behind the splash.
 * It stops just below 100 and waits for the real interface to appear.
 */
function startProgressTimeline() {
  const duration = 10000
  const from = 6
  const to = 98
  let started = 0

  const tick = (now: number) => {
    if (!started) started = now

    const t = Math.min(1, (now - started) / duration)
    const eased = t * t * (3 - 2 * t)
    setProgress(from + (to - from) * eased)

    if (t < 1) {
      requestAnimationFrame(tick)
      return
    }

    timelineDone = true
    while (timelineWaiters.length) timelineWaiters.shift()?.()
  }

  requestAnimationFrame(tick)
}

function waitForTimeline() {
  if (timelineDone) return Promise.resolve()

  return new Promise<void>((resolve) => timelineWaiters.push(resolve))
}

/**
 * Nasty helper function _for updating the text on the overlay
 */
async function updateOverlay(toUpdate: Record<string, string>) {
  const safemode = document.getElementById('safemode')
  const logs = document.getElementById('logContainer')

  for (const [key, value] of Object.entries(toUpdate)) {
    if (key === 'midtitle') {
      setStatus(value)
    }
    if (key === 'progress') {
      const progress = Number(value)
      if (!Number.isNaN(progress)) setProgress(progress, currentStatus)
    }
    if (key === 'safemode' && safemode) safemode.textContent = value
    if (key === 'logs' && logs) {
      logs.textContent = value
      logs.classList.remove('pc-flash')
      void logs.offsetWidth
      logs.classList.add('pc-flash')
    }
  }
}

function updateLoadingState(progress: number, status: string) {
  const connectionLabel = document.getElementById('connectionLabel')
  const feedTitle = document.getElementById('feedTitle')
  const sessionState = document.getElementById('sessionState')
  const progressValue = document.getElementById('progressValue')
  const stageRows = Array.from(document.querySelectorAll<HTMLElement>('.stage-row'))
  let activeAssigned = false

  if (connectionLabel) connectionLabel.textContent = progress >= 100 ? 'CONNECTED' : 'LOADING'
  if (feedTitle) feedTitle.textContent = status.replace(/[.]+$/, '') || 'Connecting to Discord'
  if (sessionState) sessionState.textContent = progress >= 100 ? 'Ready' : 'In progress'
  if (progressValue) progressValue.textContent = `${Math.floor(progress)}%`

  for (const row of stageRows) {
    const isDone = progress >= Number(row.dataset.complete)
    const isActive = !isDone && !activeAssigned
    row.classList.toggle('is-done', isDone)
    row.classList.toggle('is-active', isActive)

    const state = row.querySelector('.stage-state')
    if (state) state.textContent = isDone ? 'DONE' : isActive ? 'NOW' : 'WAIT'
    if (isActive) activeAssigned = true
  }
}

function discordInterfaceReady() {
  if (document.visibilityState === 'hidden') return false

  const mount = document.querySelector<HTMLElement>('#app-mount')

  if (!mount) return false

  const rect = mount.getBoundingClientRect()

  if (rect.width < 200 || rect.height < 200) return false

  // Deliberately narrow: a broad `[class*="chat_"]` match used to fire on
  // a blank/failed Discord page and dismiss the splash over a black window.
  return !!mount.querySelector(
    'input[name="email"], input[name="password"], [class*="authBox"], [data-list-id="guildsnav"], [data-list-id="chat-messages"]',
  )
}

async function waitForDiscordReady(loadingContainer: HTMLDivElement) {
  while (loadingContainer.isConnected && !discordInterfaceReady()) {
    await timeout(250)
  }
}

async function handleThemeInjection() {
  const { invoke } = window.__TAURI__.core

  // This needs to exist for hot-switching to work
  const ts = document.createElement('style')
  ts.id = 'dorion-theme'
  document.body.appendChild(ts)

  if (!window.__DORION_CONFIG__?.themes || window.__DORION_CONFIG__?.themes.length === 0) return ''

  updateOverlay({
    midtitle: 'Loading theme CSS...'
  })

  // Get the initial theme
  const themeContents = await invoke('get_themes').catch(e => console.error(e)) || ''

  updateOverlay({
    midtitle: 'Localizing CSS imports...'
  })

  // Create a "name" for the "theme" (or combo) based on the retrieved enabled theme list
  const themeNames = await invoke('get_enabled_themes').catch(e => console.error(e)) || []
  // Gotta adhere to filename length restrictions
  const themeName = themeNames.join('').substring(0, 254)

  // Localize the imports. On windows this no longer does anything
  const localized = await invoke('localize_imports', {
    css: themeContents,
    name: themeName
  })

  // This will use the DOM in a funky way to validate the css, then we make sure to fix up quotes
  const cleanContents = cssSanitize(localized)?.replaceAll('\\"', '\'')

  return `;(() => {
    const ts = document.querySelector('#dorion-theme')
    ts.textContent = \`
      ${cleanContents?.replace(/`/g, '\\`')
      // To this day I do not know why I need to do this
      .replace(/\\8/g, '')
      .replace(/\\9/g, '')
    }
    \`

    console.log('[Theme Loader] Appending Styles')
  })()`
}

async function handleClientModThemeInjection() {
  const { invoke } = window.__TAURI__.core

  const ts = document.createElement('style')
  ts.id = 'dorion-client-mods-themes'
  document.body.appendChild(ts)

  updateOverlay({
    midtitle: 'Loading client mod theme CSS...'
  })

  // Get the initial theme
  const themeContents = await invoke('load_mods_css')

  // This will use the DOM in a funky way to validate the css, then we make sure to fix up quotes
  const cleanContents = cssSanitize(themeContents)?.replaceAll('\\"', '\'')

  return `;(() => {
    const ts = document.querySelector('#dorion-client-mods-themes')
    ts.textContent = \`
      ${cleanContents?.replace(/`/g, '\\`')
      // To this day I do not know why I need to do this
      .replace(/\\8/g, '')
      .replace(/\\9/g, '')
    }
    \`

    console.log('[Theme Loader] Appending Client Mod Styles')
  })()`
}

/**
 * The splash belongs to the main window. Popout windows still receive the rest
 * of the injection, but they should not be covered by a boot screen.
 */
async function shouldShowSplash() {
  try {
    const winApi = (window.__TAURI__ as {
      window?: { getCurrentWindow?: () => { label?: string } }
    }).window
    const label = winApi?.getCurrentWindow?.().label

    return !label || label === 'main'
  } catch (_e) {
    return true
  }
}

/**
 * A tiny black/gold screen painted before the compiled splash arrives.
 * It guarantees the app never shows Discord's own boot screen first.
 */
const FALLBACK_SPLASH = `
  <div style="position:fixed;inset:0;display:grid;place-items:center;background:#070604;color:#f2e4c0;font-family:'Segoe UI',system-ui,sans-serif">
    <div style="text-align:center">
      <div style="font-size:34px;font-weight:700;letter-spacing:-0.03em;color:#f7e7b5">ParsCord</div>
      <div style="margin-top:10px;font-size:10px;letter-spacing:0.4em;color:#c9a85a">LOADING DISCORD</div>
      <div style="width:220px;height:4px;margin:18px auto 0;border-radius:99px;background:rgba(215,182,101,.16);overflow:hidden">
        <div style="height:100%;width:6%;border-radius:99px;background:linear-gradient(90deg,#a88a4a,#f7e7b5);animation:pc-fallback 10s linear forwards"></div>
      </div>
      <style>@keyframes pc-fallback{from{width:6%}to{width:98%}}</style>
    </div>
  </div>
`

/**
 * Keep the overlay in the browser's top layer. Discord renders its own boot
 * screen after the initialization script runs, so a high z-index alone can
 * still lose to it.
 */
function keepSplashOnTop(el: HTMLDivElement) {
  if (typeof el.showPopover === 'function') {
    try {
      el.setAttribute('popover', 'manual')
      el.showPopover()
      return
    } catch (_e) {
      el.removeAttribute('popover')
    }
  }

  // Fallback for webviews without the Popover API: stay last in <body>.
  const pin = window.setInterval(() => {
    if (!el.isConnected) {
      window.clearInterval(pin)
      return
    }

    if (document.body.lastElementChild !== el) document.body.appendChild(el)
  }, 750)
}

/**
 * Display the splashscreen
 */
async function displayLoadingTop() {
  // Check if native splash window is already active (splash.rs creates it before main window)
  // If so, skip the web-based loading to avoid conflicts
  try {
    const winApi = (window.__TAURI__ as {
      window?: { getCurrentWindow?: () => { label?: string } }
    }).window
    const label = winApi?.getCurrentWindow?.().label

    // If we're in the main window and native splash might be active, don't add web-based loading
    if (label === 'main') {
      console.log('Native splash window is active, skipping web-based loading')
      return
    }
  } catch (_e) {
    // If we can't determine the label, proceed with web-based loading as fallback
  }

  const { invoke } = window.__TAURI__.core
  const loadingContainer = document.createElement('div') satisfies HTMLDivElement
  loadingContainer.id = 'loadingContainer'
  loadingContainer.innerHTML = FALLBACK_SPLASH

  loadingContainer.style.zIndex = '2147483647'
  loadingContainer.style.position = 'fixed'
  loadingContainer.style.inset = '0'
  loadingContainer.style.width = '100%'
  loadingContainer.style.height = '100%'
  loadingContainer.style.margin = '0'
  loadingContainer.style.border = '0'
  loadingContainer.style.padding = '0'

  document.body.appendChild(loadingContainer)
  keepSplashOnTop(loadingContainer)

  // Swap in the real animated splash as soon as the compiled markup arrives.
  try {
    const html = await invoke('get_index')

    if (html && loadingContainer.isConnected) loadingContainer.innerHTML = html
  } catch (e) {
    console.error('Failed to load the splash markup', e)
  }
}
