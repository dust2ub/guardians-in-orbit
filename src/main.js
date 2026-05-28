import { createClient } from '@supabase/supabase-js'
import './styles.css'

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(err => console.warn('[SW] Registration failed:', err))
  })
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const MAX_VISIBLE_SHIPS = 5
const MOBILE_VISIBLE_SHIPS = 2

const SHIP_VARIANTS = [
  '/assets/ship-1.png',
  '/assets/ship-2.png',
  '/assets/ship-3.png',
  '/assets/ship-4.png',
  '/assets/ship-5.png',
  '/assets/ship-6.png'
]

const CLASSES = ['Hunter', 'Titan', 'Warlock']

const CLASS_COLORS = {
  Hunter:  'rgba(90, 134, 163, 0.9)',
  Titan:   'rgba(172,  48,  51, 0.9)',
  Warlock: 'rgba(210, 158,  38, 0.9)',
}

const CLASS_SVG = {
  Hunter: `<svg viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg" fill="none">
    <path d="m88.13,97.25l35.17,0l-35.17,52.2502l35.18,0l-38.12,56.635l-35.185,0l35.17,-52.25l-35.175,0l35.165,-52.2502l-35.165,0l38.115,-56.635l35.185,0l-35.17,52.25z" fill="currentColor"/>
    <path d="m196.615,101.635l-35.165,0l35.165,52.2502l-35.175,0l35.17,52.25l-35.185,0l-38.115,-56.635l35.175,0l-35.17,-52.2502l35.17,0l-35.17,-52.25l35.185,0l38.115,56.635z" fill="currentColor"/>
  </svg>`,

  Titan: `<svg viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg" fill="none">
    <path fill="currentColor" d="m208.31,71.5752c2.24,-1.29 2.24,-3.405 0,-4.695l-79.22,-45.73497c-2.235,-1.29 -5.89,-1.29 -8.125,0l-79.22,45.73497c-2.24,1.29 -2.24,3.405 0,4.695l79.2,45.7401c2.235,1.285 5.89,1.285 8.125,0l79.24,-45.7401z"/>
    <path fill="currentColor" d="m30,78.6902c0,-2.58 1.825,-3.64 4.065,-2.35l79.225,45.7648c2.23,1.29 2.23,3.4 0,4.69l-79.225,45.74c-2.24,1.29 -4.065,0.235 -4.065,-2.345l0,-91.4998z"/>
    <path fill="currentColor" d="m135.625,126.77c-2.23,-1.29 -2.23,-3.4 0,-4.69l79.22,-45.7398c2.235,-1.29 4.065,-0.23 4.065,2.35l0,91.4648c0,2.58 -1.83,3.635 -4.065,2.345l-79.22,-45.73z"/>
    <path fill="currentColor" d="m41.745,181.97c-2.24,-1.29 -2.24,-3.4 0,-4.69l79.22,-45.74c2.235,-1.285 5.89,-1.285 8.125,0l79.2,45.74c2.24,1.29 2.24,3.4 0,4.69l-79.22,45.74c-2.235,1.29 -5.89,1.29 -8.125,0l-79.2,-45.74z"/>
  </svg>`,

  Warlock: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" fill="none">
    <path fill="currentColor" d="m83.635,181.5849l-58.635,0l108.9553,-166.5849l29.315,44.825l-79.6353,121.7599z"/>
    <path fill="currentColor" d="m196.0653,109.9549l-46.84,71.63l-58.645,0l76.165,-116.4499l29.32,44.8199z"/>
    <path fill="currentColor" d="m199.5453,104.6499l29.315,-44.8249l-29.315,-44.825l-29.325,44.825l29.325,44.8249z"/>
    <path fill="currentColor" d="m235.8003,59.825l29.325,-44.825l108.955,166.5849l-58.635,0l-79.645,-121.7599z"/>
    <path fill="currentColor" d="m308.4953,181.5849l-76.165,-116.4499l-29.325,44.8199l46.86,71.63l58.63,0z"/>
    <path fill="currentColor" d="m199.5453,115.2649l43.37,66.32l-86.755,0l43.385,-66.32z"/>
  </svg>`,
}

const PETITION_URL = 'https://www.change.org/p/petition-sony-to-develop-destiny-3'

const state = {
  uploadedShipUrl: null,
  userId: crypto.randomUUID(),
  shipVariant: Math.floor(Math.random() * SHIP_VARIANTS.length),
  guardianClass: null,
  channel: null,
  guardians: [],
  quests: loadQuests(),
  questPanelOpen: false,
  ghostPanelOpen: false,
  clockInterval: null,
  musicTrack: 'lullaby',  // 'lullaby' | 'orbit' | 'off'
  d2Players: null
}

const app = document.querySelector('#app')

renderIntro()

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadQuests() {
  try {
    const saved = localStorage.getItem('orbit-quests')
    if (saved) return JSON.parse(saved)
  } catch (_) {}
  return [
    { id: crypto.randomUUID(), text: 'Complete Strikes (x3)', done: false },
    { id: crypto.randomUUID(), text: 'Play a Crucible match', done: false },
    { id: crypto.randomUUID(), text: 'Weekly Story Mission', done: true },
    { id: crypto.randomUUID(), text: 'Farm for Exotics', done: false }
  ]
}

function saveQuests() {
  try {
    localStorage.setItem('orbit-quests', JSON.stringify(state.quests))
  } catch (_) {}
}

// ─── Intro Screen ─────────────────────────────────────────────────────────────

function renderIntro() {
  app.innerHTML = `
    <main class="intro screen">
      <section class="intro-card">
        <p class="eyebrow">Unofficial Destiny 2 Fansite</p>
        <h1>Guardians in Orbit</h1>
        <p class="intro-sub">Choose your class and join Guardians waiting for Destiny 3.</p>

        <div class="class-picker" role="group" aria-label="Choose your Guardian class">
          ${CLASSES.map(cls => `
            <button class="class-btn" data-class="${cls}" aria-pressed="false" type="button">
              <span class="class-icon">${CLASS_SVG[cls]}</span>
              <span class="class-name">${cls}</span>
            </button>
          `).join('')}
        </div>

        <div class="ship-guide">
          <p class="ship-guide-text">
            Find your ship on
            <a href="https://www.light.gg/db/category/42/ships/" target="_blank" rel="noopener noreferrer">light.gg</a>
            and download an image from the <strong>Screenshots</strong> tab.
            Then remove the background using
            <a href="https://www.remove.bg" target="_blank" rel="noopener noreferrer">remove.bg</a>
            before uploading.
          </p>
        </div>

        <label class="upload-box" id="upload-box">
          <input id="ship-upload" type="file" accept="image/*" />
          <span id="upload-label">Upload your jumpship image</span>
        </label>

        <p id="upload-status" class="upload-status" aria-live="polite"></p>

        <button id="enter-button" class="primary" disabled>
          Choose a class to enter Orbit
        </button>

        <a
          href="${PETITION_URL}"
          target="_blank"
          rel="noopener noreferrer"
          class="petition-link"
        >
          ✍ Sign the petition for Destiny 3
        </a>

        <footer class="disclaimer">
          Destiny 2 &copy; Bungie, Inc. All rights reserved.
        </footer>
      </section>
    </main>
  `

  document.querySelectorAll('.class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.class-btn').forEach(b => {
        b.classList.remove('selected')
        b.setAttribute('aria-pressed', 'false')
      })
      btn.classList.add('selected')
      btn.setAttribute('aria-pressed', 'true')
      state.guardianClass = btn.dataset.class

      const enterBtn = document.querySelector('#enter-button')
      enterBtn.disabled = false
      enterBtn.textContent = `Enter Orbit as ${state.guardianClass}`
    })
  })

  const input = document.querySelector('#ship-upload')
  const label = document.querySelector('#upload-label')

  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return

    const status = document.querySelector('#upload-status')
    const box = document.querySelector('#upload-box')
    const enterBtn = document.querySelector('#enter-button')

    const MAX_FILE_SIZE = 8 * 1024 * 1024 // 8MB

    status.classList.remove('status-ok', 'status-err')
    box.classList.remove('processing')

    if (state.uploadedShipUrl) {
      URL.revokeObjectURL(state.uploadedShipUrl)
      state.uploadedShipUrl = null
    }

    if (file.size > MAX_FILE_SIZE) {
      input.value = ''
      label.textContent = 'Upload your jumpship image'
      status.textContent = 'Image is too large. Please use an image under 8MB.'
      status.classList.add('status-err')
      return
    }

    state.uploadedShipUrl = URL.createObjectURL(file)
    label.textContent = file.name
    status.textContent = '✓ Uploaded'
    status.classList.add('status-ok')

    if (state.guardianClass) {
      enterBtn.disabled = false
      enterBtn.textContent = `Enter Orbit as ${state.guardianClass}`
    } else {
      enterBtn.disabled = true
      enterBtn.textContent = 'Choose a class to enter Orbit'
    }
  })

  document.querySelector('#enter-button').addEventListener('click', async () => {
    if (!state.guardianClass) return
    renderOrbit()
    await connectPresence()
    tryPlayMusic()
  })
}

// ─── Orbit Screen ─────────────────────────────────────────────────────────────

function renderOrbit() {
  app.innerHTML = `
    <main class="orbit screen">
      <div class="stars"></div>
      <div class="vignette"></div>

      <header class="hud">
        <div>
          <p class="eyebrow">Orbit : Earth</p>
          <h1 id="guardian-count">Entering Orbit&hellip;</h1>
          <div class="class-counts" id="class-counts"></div>
        </div>

        <div class="hud-right">
          <div class="sound-picker" role="group" aria-label="Music track">
            <button class="sound-opt active" data-track="lullaby">Lullaby</button>
            <button class="sound-opt" data-track="orbit">Orbit</button>
            <button class="sound-opt" data-track="off">Off</button>
          </div>
          <button
            id="quest-toggle"
            class="ghost quest-toggle-btn"
            aria-label="Toggle quest panel"
            aria-expanded="false"
          >
            <span class="quest-toggle-label">Today's Quests</span>
            <span class="quest-badge" id="quest-badge">0</span>
          </button>
        </div>
      </header>

      <a
        href="${PETITION_URL}"
        target="_blank"
        rel="noopener noreferrer"
        class="petition-btn"
        aria-label="Sign the Destiny 3 petition"
      >
        ✍ We want Destiny 3
      </a>

      <div class="clock-block">
        <div class="clock-time" id="clock-time">--:--</div>
        <div class="clock-date" id="clock-date"></div>
        <div class="clock-greeting-row">
          <div class="clock-greeting" id="clock-greeting"></div>
          <button
            id="ghost-toggle"
            class="ghost-inline-btn"
            aria-label="Toggle Ghost panel"
            aria-expanded="false"
          >
          <img width=30px src="/assets/ghost.webp" />
          </button>
        </div>
      </div>

      <section id="ship-layer" class="ship-layer" aria-label="Guardians in orbit"></section>

      <aside class="quest-panel" id="quest-panel" aria-hidden="true">
        <div class="quest-panel-header">
          <span class="quest-panel-title">Today's Quests</span>
          <div class="quest-panel-meta">
            <span class="quest-count-text" id="quest-count-text">0 / 0</span>
            <button class="quest-close-btn" id="quest-close-btn" aria-label="Close panel">&times;</button>
          </div>
        </div>
        <div class="quest-progress-bar">
          <div class="quest-progress-fill" id="quest-progress-fill"></div>
        </div>
        <ul class="quest-list" id="quest-list" role="list"></ul>
        <div class="quest-add-row">
          <input
            class="quest-input"
            id="quest-input"
            type="text"
            placeholder="Add a new quest&hellip;"
            maxlength="60"
            aria-label="New quest"
          />
          <button class="quest-add-btn" id="quest-add-btn">Add</button>
        </div>
      </aside>

      <!-- Ghost Panel -->
      <aside class="ghost-panel" id="ghost-panel" aria-hidden="true">
        <div class="ghost-panel-header">
          <span class="ghost-panel-title">Ghost</span>
          <button class="quest-close-btn" id="ghost-close-btn" aria-label="Close Ghost panel">&times;</button>
        </div>
        <div class="ghost-search-row">
          <input
            class="quest-input ghost-input"
            id="ghost-input"
            type="text"
            placeholder="Guardian#1234"
            maxlength="40"
            aria-label="Bungie display name"
          />
          <button class="quest-add-btn ghost-search-btn" id="ghost-search-btn">Scan</button>
        </div>
        <div class="ghost-body" id="ghost-body">
          <p class="ghost-hint">Enter your Bungie name to summon your Ghost.</p>
        </div>
      </aside>

      <audio id="bgm" loop preload="auto"></audio>

      <footer class="orbit-footer">
        <span>Unofficial fansite &mdash; Destiny 2 belongs to Bungie.</span>
      </footer>
    </main>
  `

  document.querySelector('#quest-toggle').addEventListener('click', openQuestPanel)
  document.querySelector('#quest-close-btn').addEventListener('click', closeQuestPanel)
  document.querySelector('#quest-add-btn').addEventListener('click', addQuest)
  document.querySelector('#quest-panel').addEventListener('click', e => e.stopPropagation())

  document.querySelector('#ghost-toggle').addEventListener('click', toggleGhostPanel)
  document.querySelector('#ghost-close-btn').addEventListener('click', closeGhostPanel)
  document.querySelector('#ghost-panel').addEventListener('click', e => e.stopPropagation())
  document.querySelector('#ghost-search-btn').addEventListener('click', searchGuardian)
  document.querySelector('#ghost-input').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return
    e.preventDefault()
    searchGuardian()
  })

  const questInput = document.querySelector('#quest-input')
  questInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return
    if (e.isComposing || e.keyCode === 229) return
    e.preventDefault()
    addQuest()
  })

  document.querySelectorAll('.sound-opt').forEach(btn => {
    btn.addEventListener('click', () => selectTrack(btn.dataset.track))
  })

  document.querySelector('.orbit').addEventListener('click', e => {
    const panel  = document.querySelector('#quest-panel')
    const toggle = document.querySelector('#quest-toggle')
    if (state.questPanelOpen && !panel.contains(e.target) && !toggle.contains(e.target)) {
      closeQuestPanel()
    }
    const ghostPanel  = document.querySelector('#ghost-panel')
    const ghostToggle = document.querySelector('#ghost-toggle')
    if (state.ghostPanelOpen && !ghostPanel.contains(e.target) && !ghostToggle.contains(e.target)) {
      closeGhostPanel()
    }
  })

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    if (state.questPanelOpen) closeQuestPanel()
    if (state.ghostPanelOpen) closeGhostPanel()
  })

  startClock()
  renderQuestPanel()
  drawShips()
  fetchD2Players()
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function startClock() {
  if (state.clockInterval) clearInterval(state.clockInterval)
  updateClock()
  state.clockInterval = setInterval(updateClock, 1000)
}

function updateClock() {
  const timeEl  = document.querySelector('#clock-time')
  const dateEl  = document.querySelector('#clock-date')
  const greetEl = document.querySelector('#clock-greeting')
  if (!timeEl) return

  const now = new Date()
  const h   = String(now.getHours()).padStart(2, '0')
  const m   = String(now.getMinutes()).padStart(2, '0')
  timeEl.textContent = `${h}:${m}`

  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December']
  dateEl.textContent = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`

  const hr = now.getHours()
  let greeting = 'Good morning, Guardian.'
  if (hr >= 12 && hr < 18) greeting = 'Good afternoon, Guardian.'
  else if (hr >= 18 || hr < 5) greeting = 'Good evening, Guardian.'
  greetEl.textContent = greeting
}

// ─── Quest Panel ──────────────────────────────────────────────────────────────

function openQuestPanel() {
  state.questPanelOpen = true
  const panel = document.querySelector('#quest-panel')
  panel.classList.add('open')
  panel.setAttribute('aria-hidden', 'false')
  document.querySelector('#quest-toggle').setAttribute('aria-expanded', 'true')
  document.querySelector('#quest-input')?.focus()
}

function closeQuestPanel() {
  state.questPanelOpen = false
  const panel = document.querySelector('#quest-panel')
  panel.classList.remove('open')
  panel.setAttribute('aria-hidden', 'true')
  document.querySelector('#quest-toggle').setAttribute('aria-expanded', 'false')
}

function addQuest() {
  const input = document.querySelector('#quest-input')
  const val = input.value.trim()
  if (!val) return
  state.quests.push({ id: crypto.randomUUID(), text: val, done: false })
  input.value = ''
  saveQuests()
  renderQuestPanel()
  input.focus()
}

function toggleQuest(id) {
  const quest = state.quests.find(q => q.id === id)
  if (quest) { quest.done = !quest.done; saveQuests(); renderQuestPanel() }
}

function deleteQuest(id) {
  state.quests = state.quests.filter(q => q.id !== id)
  saveQuests()
  renderQuestPanel()
}

function renderQuestPanel() {
  const list      = document.querySelector('#quest-list')
  const countText = document.querySelector('#quest-count-text')
  const badge     = document.querySelector('#quest-badge')
  const fill      = document.querySelector('#quest-progress-fill')
  if (!list) return

  const total     = state.quests.length
  const done      = state.quests.filter(q => q.done).length
  const remaining = total - done

  if (countText) countText.textContent = `${done} / ${total}`
  if (badge) {
    badge.textContent = remaining
    badge.classList.toggle('badge-done', remaining === 0)
  }
  if (fill) fill.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%'

  list.innerHTML = ''
  state.quests.forEach(quest => {
    const li = document.createElement('li')
    li.className = `quest-item${quest.done ? ' done' : ''}`
    li.setAttribute('role', 'listitem')
    li.innerHTML = `
      <button class="quest-check" aria-label="${quest.done ? 'Mark incomplete' : 'Mark complete'}" data-id="${quest.id}">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1.5 5.5L3.8 8L8.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="quest-text">${escapeHtml(quest.text)}</span>
      <button class="quest-del" aria-label="Delete quest" data-id="${quest.id}">&times;</button>
    `
    li.querySelector('.quest-check').addEventListener('click', () => toggleQuest(quest.id))
    li.querySelector('.quest-del').addEventListener('click',  () => deleteQuest(quest.id))
    list.appendChild(li)
  })
}

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Presence ─────────────────────────────────────────────────────────────────

async function connectPresence() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.warn('Missing Supabase env vars. Running in solo mode.')
    state.guardians = [{
      userId:        state.userId,
      shipVariant:   state.shipVariant,
      guardianClass: state.guardianClass,
      joinedAt:      Date.now(),
      seed:          Math.random()
    }]
    updatePresenceUi()
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  const channel  = supabase.channel('guardians-in-orbit', {
    config: { presence: { key: state.userId } }
  })

  state.channel = channel

  channel
    .on('presence', { event: 'sync' }, () => {
      state.guardians = Object.values(channel.presenceState()).flat()
      updatePresenceUi()
    })
    .subscribe(async status => {
      if (status !== 'SUBSCRIBED') return
      await channel.track({
        userId:        state.userId,
        shipVariant:   state.shipVariant,
        guardianClass: state.guardianClass,
        joinedAt:      Date.now(),
        seed:          Math.random()
      })
    })
}

// ─── Presence UI ──────────────────────────────────────────────────────────────

function updatePresenceUi() {
  renderGuardianCount()
  renderClassCounts()
  drawShips()
}

function renderClassCounts() {
  const el = document.querySelector('#class-counts')
  if (!el) return

  const tally = { Hunter: 0, Titan: 0, Warlock: 0 }
  state.guardians.forEach(g => {
    if (g.guardianClass && tally[g.guardianClass] !== undefined) tally[g.guardianClass]++
  })

  el.innerHTML = CLASSES.map(cls => `
    <span class="class-count-chip" style="--chip-color: ${CLASS_COLORS[cls]}">
      <span class="class-count-icon">${CLASS_SVG[cls]}</span>
      <span class="class-count-label">${cls}</span>
      <span class="class-count-num">${tally[cls]}</span>
    </span>
  `).join('')
}

function drawShips() {
  const layer = document.querySelector('#ship-layer')
  if (!layer) return

  const maxShips = window.matchMedia('(max-width: 720px)').matches
    ? MOBILE_VISIBLE_SHIPS
    : MAX_VISIBLE_SHIPS

  const others = state.guardians
    .filter(g => g.userId !== state.userId)
    .sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))
    .slice(0, maxShips)

  const myShip = state.uploadedShipUrl || '/assets/ship-0.png'

  const availableVariants = SHIP_VARIANTS
    .map((_, i) => i)
    .filter(i => i !== state.shipVariant)

  const assigned = new Set([state.shipVariant])

  layer.innerHTML = `
    <img class="ship my-ship" src="${myShip}" alt="Your jumpship" />
    ${others.map((guardian, index) => {
      let variant = (guardian.shipVariant ?? index) % SHIP_VARIANTS.length
      if (assigned.has(variant)) {
        const fallback = availableVariants.find(v => !assigned.has(v))
        if (fallback !== undefined) variant = fallback
      }
      assigned.add(variant)
      const delay = Math.round((guardian.seed ?? Math.random()) * 6000)
      return `
        <img
          class="ship other-ship ship-${index}"
          src="${SHIP_VARIANTS[variant]}"
          alt="Another Guardian's jumpship"
          style="animation-delay: ${delay}ms"
        />
      `
    }).join('')}
  `
}

// ─── D2 Live Players ──────────────────────────────────────────────────────────

async function fetchD2Players() {
  try {
    const res  = await fetch('/api/d2-players')
    if (!res.ok) throw new Error('non-ok response')
    const data = await res.json()
    state.d2Players = data.players ?? null
  } catch (_) {
    state.d2Players = null
  }
  renderD2Players()
  setTimeout(fetchD2Players, 5 * 60 * 1000)
}

function renderD2Players() {
  renderGuardianCount()
}

function renderGuardianCount() {
  const el = document.querySelector('#guardian-count')
  if (!el) return

  const site = state.guardians.length
  const game = state.d2Players

  if (game === null) {
    el.textContent = `${site.toLocaleString()} Guardian${site === 1 ? '' : 's'} in Orbit`
    return
  }

  el.textContent = `${game.toLocaleString()} + ${site.toLocaleString()} Guardians in Orbit`
}

// ─── Ghost Panel ──────────────────────────────────────────────────────────────

function toggleGhostPanel() {
  if (state.ghostPanelOpen) closeGhostPanel()
  else openGhostPanel()
}

function openGhostPanel() {
  state.ghostPanelOpen = true
  if (state.questPanelOpen) closeQuestPanel()
  const panel = document.querySelector('#ghost-panel')
  panel.classList.add('open')
  panel.setAttribute('aria-hidden', 'false')
  document.querySelector('#ghost-toggle').setAttribute('aria-expanded', 'true')
  document.querySelector('#ghost-input')?.focus()
}

function closeGhostPanel() {
  state.ghostPanelOpen = false
  const panel = document.querySelector('#ghost-panel')
  panel.classList.remove('open')
  panel.setAttribute('aria-hidden', 'true')
  document.querySelector('#ghost-toggle')?.setAttribute('aria-expanded', 'false')
}

async function searchGuardian() {
  const input = document.querySelector('#ghost-input')
  const body  = document.querySelector('#ghost-body')
  const btn   = document.querySelector('#ghost-search-btn')
  if (!input || !body) return

  const name = input.value.trim()
  if (!name) return

  body.innerHTML = '<p class="ghost-hint ghost-loading">Scanning for Guardian…</p>'
  btn.disabled = true

  try {
    const searchRes  = await fetch(`/api/bungie-search?name=${encodeURIComponent(name)}`)
    const searchData = await searchRes.json()

    if (!searchData.results?.length) {
      body.innerHTML = '<p class="ghost-hint ghost-err">Guardian not found. Check your Bungie name (e.g. Name#1234).</p>'
      return
    }

    const player = searchData.results[0]
    body.innerHTML = '<p class="ghost-hint ghost-loading">Downloading your record…</p>'

    const profileRes = await fetch(
      `/api/bungie-profile?membershipId=${player.membershipId}&membershipType=${player.membershipType}`
    )
    const profile = await profileRes.json()

    if (profile.error) {
      body.innerHTML = `<p class="ghost-hint ghost-err">Failed to load profile: ${escapeHtml(profile.error)}</p>`
      return
    }

    renderGhostProfile(player, profile)
  } catch (err) {
    body.innerHTML = '<p class="ghost-hint ghost-err">Connection lost, Guardian. Try again.</p>'
    console.error('[Ghost]', err)
  } finally {
    btn.disabled = false
  }
}

function renderGhostProfile(player, profile) {
  const body = document.querySelector('#ghost-body')
  if (!body) return

  function fmtTime(minutes) {
    if (!minutes) return '0h'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  function fmtDate(iso) {
    if (!iso) return 'Unknown'
    const d = new Date(iso)
    const diffDays = Math.floor((Date.now() - d) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7)   return `${diffDays} days ago`
    if (diffDays < 30)  return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
  }

  const displayName = `${player.displayName}#${player.displayCode ?? '????'}`
  const topChar     = profile.characters?.sort((a, b) => b.light - a.light)[0]

  const lines = [
    `Found you, <strong>${escapeHtml(displayName)}</strong>.`,
    `Last seen: <strong>${fmtDate(profile.dateLastPlayed)}</strong>.`,
    `Total field time: <strong>${fmtTime(profile.totalMinutes)}</strong>.`,
  ]

  if (topChar) {
    lines.push(`Highest-power ${topChar.class}: <strong>${topChar.light} Power</strong>.`)
  }
  if (profile.triumphScore) {
    lines.push(`Triumph Score: <strong>${profile.triumphScore.toLocaleString()}</strong>.`)
  }
  if (profile.clan) {
    lines.push(`Clan: <strong>${escapeHtml(profile.clan.name)}</strong>${profile.clan.motto ? ` — "${escapeHtml(profile.clan.motto)}"` : ''}.`)
  }

  const charLines = (profile.characters || []).map(c => `
    <li class="ghost-char-item">
      <span class="ghost-char-class">${c.class}</span>
      <span class="ghost-char-meta">${c.race} · ${c.light}⚡ · ${fmtTime(c.minutesPlayed)}</span>
    </li>
  `).join('')

  body.innerHTML = `
    <div class="ghost-speech">
      ${lines.map(l => `<p class="ghost-line">${l}</p>`).join('')}
    </div>
    ${charLines ? `<ul class="ghost-char-list">${charLines}</ul>` : ''}
  `
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function tryPlayMusic() {
  selectTrack(state.musicTrack)
}

function selectTrack(track) {
  const audio = document.querySelector('#bgm')
  if (!audio) return

  state.musicTrack = track

  document.querySelectorAll('.sound-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.track === track)
  })

  if (track === 'off') {
    audio.pause()
    return
  }

  const src     = track === 'lullaby' ? '/assets/lullaby.mp3' : '/assets/orbit.mp3'
  const nextSrc = new URL(src, location.href).href

  audio.volume = 0.36

  if (audio.src !== nextSrc) {
    audio.pause()
    audio.src = src
    audio.load()
    audio.play().catch(() => {})
  } else if (audio.paused) {
    audio.play().catch(() => {})
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

window.addEventListener('resize', drawShips)

window.addEventListener('beforeunload', () => {
  if (state.channel)         state.channel.untrack()
  if (state.uploadedShipUrl) URL.revokeObjectURL(state.uploadedShipUrl)
  if (state.clockInterval)   clearInterval(state.clockInterval)
})