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
  guardians: []
}

const app = document.querySelector('#app')

renderIntro()

function renderIntro() {
  app.innerHTML = `
    <main class="intro screen">
      <section class="intro-card">
        <p class="eyebrow">Unofficial Destiny 2 Fansite</p>

        <h1>Guardians in Orbit</h1>

        <label class="upload-box">
          <input id="ship-upload" type="file" accept="image/*" />
          <span id="upload-label">
            Upload your jumpship
          </span>
        </label>

        <button id="enter-button" class="primary">
          Enter Orbit
        </button>

        <footer class="disclaimer">
          Destiny 2 © Bungie, Inc. All rights reserved.
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

    if (state.uploadedShipUrl) {
      URL.revokeObjectURL(state.uploadedShipUrl)
    }

    state.uploadedShipUrl = URL.createObjectURL(file)
    label.textContent = file.name
  })

  button.addEventListener('click', async () => {
    renderOrbit()
    await connectPresence()
    tryPlayMusic()
  })
}

function renderOrbit() {
  app.innerHTML = `
    <main class="orbit screen">
      <div class="stars"></div>
      <div class="vignette"></div>

      <header class="hud">
        <div>
          <p class="eyebrow">Orbit : Earth</p>
          <h1 id="guardian-count">
            Entering Orbit…
          </h1>
        </div>

        <button id="sound-button" class="ghost">
          Sound: On
        </button>
      </header>

      <section
        id="ship-layer"
        class="ship-layer"
        aria-label="Guardians in orbit"
      ></section>

      <audio
        id="bgm"
        src="/assets/lullaby.mp3"
        loop
        preload="auto"
      ></audio>

      <footer class="orbit-footer">
        <span>
          Unofficial fansite. Destiny 2 belongs to Bungie.
        </span>
      </footer>
    </main>
  `

  document
    .querySelector('#sound-button')
    .addEventListener('click', toggleMusic)

  drawShips()
}

async function connectPresence() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.warn(
      'Missing Supabase env vars. Running in local visual-only mode.'
    )

    state.guardians = mockGuardians()
    updatePresenceUi()
    return
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  )

  const channel = supabase.channel('guardians-in-orbit', {
    config: {
      presence: {
        key: state.userId
      }
    }
  })

  state.channel = channel

  channel
    .on('presence', { event: 'sync' }, () => {
      const presence = channel.presenceState()

      state.guardians = Object
        .values(presence)
        .flat()

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
  const count = Math.max(state.guardians.length, 1)

  document.querySelector('#guardian-count').textContent =
    `${count} Guardian${count === 1 ? '' : 's'} in Orbit`

  drawShips()
}

function drawShips() {
  const layer = document.querySelector('#ship-layer')

  if (!layer) return

  const maxShips = window.matchMedia('(max-width: 720px)').matches
    ? MOBILE_VISIBLE_SHIPS
    : MAX_VISIBLE_SHIPS

  const others = state.guardians
    .filter((guardian) => guardian.userId !== state.userId)
    .sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))
    .slice(0, maxShips)

  const myShip =
    state.uploadedShipUrl ||
    SHIP_VARIANTS[state.shipVariant]

  layer.innerHTML = `
    <img
      class="ship my-ship"
      src="${myShip}"
      alt="Your jumpship"
    />

    ${others.map((guardian, index) => {
      const variant = guardian.shipVariant ?? index

      const delay = Math.round(
        (guardian.seed ?? Math.random()) * 6000
      )

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

function tryPlayMusic() {
  const audio = document.querySelector('#bgm')

  if (!audio) return

  audio.volume = 0.36

  audio.play().catch(() => {
    const button = document.querySelector('#sound-button')

    if (button) {
      button.textContent = 'Sound: Tap to Play'
    }
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

function mockGuardians() {
  return Array.from({ length: 7 }, (_, index) => ({
    userId:
      index === 0
        ? state.userId
        : crypto.randomUUID(),

    shipVariant:
      index % SHIP_VARIANTS.length,

    joinedAt:
      Date.now() + index,

    seed:
      Math.random()
  }))
}

window.addEventListener('resize', drawShips)

window.addEventListener('beforeunload', () => {
  if (state.channel) {
    state.channel.untrack()
  }

  if (state.uploadedShipUrl) {
    URL.revokeObjectURL(state.uploadedShipUrl)
  }
})