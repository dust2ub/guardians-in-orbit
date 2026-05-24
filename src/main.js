import { createClient } from '@supabase/supabase-js'
import './styles.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const MAX_VISIBLE_SHIPS = 5
const MOBILE_VISIBLE_SHIPS = 2

const SHIP_VARIANTS = [
  '/assets/ship.png',
  '/assets/ship.png',
  '/assets/ship.png',
  '/assets/ship.png',
  '/assets/ship.png',
  '/assets/ship.png'
]

const state = {
  uploadedShipUrl: null,
  userId: crypto.randomUUID(),
  shipVariant: Math.floor(Math.random() * SHIP_VARIANTS.length),
  channel: null,
  guardians: [],
  quests: loadQuests(),
  questPanelOpen: false,
  clockInterval: null
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

        <label class="upload-box">
          <input id="ship-upload" type="file" accept="image/*" />
          <span id="upload-label">
            Upload your jumpship image
          </span>
        </label>

        <button id="enter-button" class="primary">
          Enter Orbit
        </button>

        <footer class="disclaimer">
          Destiny 2 &copy; Bungie, Inc. All rights reserved.
        </footer>
      </section>
    </main>
  `

  const input = document.querySelector('#ship-upload')
  const label = document.querySelector('#upload-label')
  const button = document.querySelector('#enter-button')

  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    if (state.uploadedShipUrl) URL.revokeObjectURL(state.uploadedShipUrl)
    state.uploadedShipUrl = URL.createObjectURL(file)
    label.textContent = file.name
  })

  button.addEventListener('click', async () => {
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
        </div>

        <div class="hud-right">
          <button id="sound-button" class="ghost">Sound: On</button>
          <button id="quest-toggle" class="ghost quest-toggle-btn" aria-label="Toggle quest panel" aria-expanded="false">
            <span class="quest-toggle-label">Today's Quests</span>
            <span class="quest-badge" id="quest-badge">0</span>
          </button>
        </div>
      </header>

      <div class="clock-block">
        <div class="clock-time" id="clock-time">--:--</div>
        <div class="clock-date" id="clock-date"></div>
        <div class="clock-greeting" id="clock-greeting"></div>
      </div>

      <section
        id="ship-layer"
        class="ship-layer"
        aria-label="Guardians in orbit"
      ></section>

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

      <audio
        id="bgm"
        src="/assets/lullaby.mp3"
        loop
        preload="auto"
      ></audio>

      <footer class="orbit-footer">
        <span>Unofficial fan project. Destiny 2 belongs to Bungie.</span>
      </footer>
    </main>
  `

  document.querySelector('#sound-button').addEventListener('click', toggleMusic)
  document.querySelector('#quest-toggle').addEventListener('click', openQuestPanel)
  document.querySelector('#quest-close-btn').addEventListener('click', closeQuestPanel)

  document.querySelector('#quest-add-btn').addEventListener('click', addQuest)
  document.querySelector('#quest-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addQuest()
  })

  document.querySelector('.orbit').addEventListener('click', (e) => {
    const panel = document.querySelector('#quest-panel')
    const toggle = document.querySelector('#quest-toggle')
    if (
      state.questPanelOpen &&
      !panel.contains(e.target) &&
      !toggle.contains(e.target)
    ) {
      closeQuestPanel()
    }
  })

  startClock()
  renderQuestPanel()
  drawShips()
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function startClock() {
  if (state.clockInterval) clearInterval(state.clockInterval)
  updateClock()
  state.clockInterval = setInterval(updateClock, 1000)
}

function updateClock() {
  const timeEl = document.querySelector('#clock-time')
  const dateEl = document.querySelector('#clock-date')
  const greetEl = document.querySelector('#clock-greeting')
  if (!timeEl) return

  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  timeEl.textContent = `${h}:${m}`

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December']
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
  saveQuests()
  renderQuestPanel()
  input.value = ''
  input.focus()
}

function toggleQuest(id) {
  const quest = state.quests.find(q => q.id === id)
  if (quest) {
    quest.done = !quest.done
    saveQuests()
    renderQuestPanel()
  }
}

function deleteQuest(id) {
  state.quests = state.quests.filter(q => q.id !== id)
  saveQuests()
  renderQuestPanel()
}

function renderQuestPanel() {
  const list = document.querySelector('#quest-list')
  const countText = document.querySelector('#quest-count-text')
  const badge = document.querySelector('#quest-badge')
  const fill = document.querySelector('#quest-progress-fill')
  if (!list) return

  const total = state.quests.length
  const done = state.quests.filter(q => q.done).length
  const remaining = total - done

  if (countText) countText.textContent = `${done} / ${total}`
  if (badge) {
    badge.textContent = remaining
    badge.classList.toggle('badge-done', remaining === 0)
  }
  if (fill) {
    fill.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%'
  }

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
    li.querySelector('.quest-del').addEventListener('click', () => deleteQuest(quest.id))
    list.appendChild(li)
  })
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Presence ─────────────────────────────────────────────────────────────────

async function connectPresence() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    // No Supabase config — show only the current user's ship, count = 1
    console.warn('Missing Supabase env vars. Running in solo mode.')
    state.guardians = [
      {
        userId: state.userId,
        shipVariant: state.shipVariant,
        joinedAt: Date.now(),
        seed: Math.random()
      }
    ]
    updatePresenceUi()
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

  const channel = supabase.channel('guardians-in-orbit', {
    config: { presence: { key: state.userId } }
  })

  state.channel = channel

  channel
    .on('presence', { event: 'sync' }, () => {
      const presence = channel.presenceState()
      state.guardians = Object.values(presence).flat()
      updatePresenceUi()
    })
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      await channel.track({
        userId: state.userId,
        shipVariant: state.shipVariant,
        joinedAt: Date.now(),
        seed: Math.random()
      })
    })
}

function updatePresenceUi() {
  const count = state.guardians.length
  const el = document.querySelector('#guardian-count')
  if (el) el.textContent = `${count} Guardian${count === 1 ? '' : 's'} in Orbit`
  drawShips()
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

  const myShip = state.uploadedShipUrl || SHIP_VARIANTS[state.shipVariant]

  layer.innerHTML = `
    <img
      class="ship my-ship"
      src="${myShip}"
      alt="Your jumpship"
    />
    ${others.map((guardian, index) => {
      const variant = guardian.shipVariant ?? index
      const delay = Math.round((guardian.seed ?? Math.random()) * 6000)
      return `
        <img
          class="ship other-ship ship-${index}"
          src="${SHIP_VARIANTS[variant % SHIP_VARIANTS.length]}"
          alt="Another Guardian's jumpship"
          style="animation-delay: ${delay}ms"
        />
      `
    }).join('')}
  `
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function tryPlayMusic() {
  const audio = document.querySelector('#bgm')
  if (!audio) return
  audio.volume = 0.36
  audio.play().catch(() => {
    const button = document.querySelector('#sound-button')
    if (button) button.textContent = 'Sound: Tap to Play'
  })
}

function toggleMusic() {
  const audio = document.querySelector('#bgm')
  const button = document.querySelector('#sound-button')
  if (!audio || !button) return
  if (audio.paused) {
    audio.play()
    button.textContent = 'Sound: On'
  } else {
    audio.pause()
    button.textContent = 'Sound: Off'
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

window.addEventListener('resize', drawShips)

window.addEventListener('beforeunload', () => {
  if (state.channel) state.channel.untrack()
  if (state.uploadedShipUrl) URL.revokeObjectURL(state.uploadedShipUrl)
  if (state.clockInterval) clearInterval(state.clockInterval)
})