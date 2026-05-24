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

const CLASSES = ['Hunter', 'Titan', 'Warlock']

const CLASS_COLORS = {
  Hunter:  'rgba(90, 134, 163, 0.9)',
  Titan:   'rgba(172,  48,  51, 0.9)',
  Warlock: 'rgba(210, 158,  38, 0.9)',
}

// SVG icons — exact artwork from the design assets
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
        <p class="intro-sub">Choose your class and join Guardians waiting for Destiny 3.</p>

        <div class="class-picker" role="group" aria-label="Choose your Guardian class">
          ${CLASSES.map(cls => `
            <button class="class-btn" data-class="${cls}" aria-pressed="false" type="button">
              <span class="class-icon">${CLASS_SVG[cls]}</span>
              <span class="class-name">${cls}</span>
            </button>
          `).join('')}
        </div>

        <label class="upload-box">
          <input id="ship-upload" type="file" accept="image/*" />
          <span id="upload-label">Upload your jumpship image</span>
        </label>

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
    if (state.uploadedShipUrl) URL.revokeObjectURL(state.uploadedShipUrl)
    state.uploadedShipUrl = URL.createObjectURL(file)
    label.textContent = file.name
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
          <button id="sound-button" class="ghost">Sound: On</button>
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
        <div class="clock-greeting" id="clock-greeting"></div>
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

      <audio id="bgm" src="/assets/lullaby.mp3" loop preload="auto"></audio>

      <footer class="orbit-footer">
        <span>Unofficial fansite &mdash; Destiny 2 belongs to Bungie.</span>
      </footer>
    </main>
  `

  document.querySelector('#sound-button').addEventListener('click', toggleMusic)
  document.querySelector('#quest-toggle').addEventListener('click', openQuestPanel)
  document.querySelector('#quest-close-btn').addEventListener('click', closeQuestPanel)
  document.querySelector('#quest-add-btn').addEventListener('click', addQuest)
  document.querySelector('#quest-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addQuest()
  })

  document.querySelector('.orbit').addEventListener('click', e => {
    const panel  = document.querySelector('#quest-panel')
    const toggle = document.querySelector('#quest-toggle')
    if (state.questPanelOpen && !panel.contains(e.target) && !toggle.contains(e.target)) {
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
  const val   = input.value.trim()
  if (!val) return
  state.quests.push({ id: crypto.randomUUID(), text: val, done: false })
  saveQuests()
  renderQuestPanel()
  input.value = ''
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
  const count = state.guardians.length
  const el    = document.querySelector('#guardian-count')
  if (el) el.textContent = `${count} Guardian${count === 1 ? '' : 's'} in Orbit`
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

  const myShip = state.uploadedShipUrl || SHIP_VARIANTS[state.shipVariant]

  layer.innerHTML = `
    <img class="ship my-ship" src="${myShip}" alt="Your jumpship" />
    ${others.map((guardian, index) => {
      const variant = guardian.shipVariant ?? index
      const delay   = Math.round((guardian.seed ?? Math.random()) * 6000)
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
    const btn = document.querySelector('#sound-button')
    if (btn) btn.textContent = 'Sound: Tap to Play'
  })
}

function toggleMusic() {
  const audio = document.querySelector('#bgm')
  const btn   = document.querySelector('#sound-button')
  if (!audio || !btn) return
  if (audio.paused) { audio.play();  btn.textContent = 'Sound: On'  }
  else              { audio.pause(); btn.textContent = 'Sound: Off' }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

window.addEventListener('resize', drawShips)

window.addEventListener('beforeunload', () => {
  if (state.channel)         state.channel.untrack()
  if (state.uploadedShipUrl) URL.revokeObjectURL(state.uploadedShipUrl)
  if (state.clockInterval)   clearInterval(state.clockInterval)
})