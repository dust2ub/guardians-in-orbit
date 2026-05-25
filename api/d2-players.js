export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ players: null, error: 'method_not_allowed' })
  }

  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60')
  res.setHeader('Access-Control-Allow-Origin', '*')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=1085660',
      {
        headers: { 'User-Agent': 'GuardiansInOrbit/1.0' },
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      throw new Error(`Steam API returned ${response.status}`)
    }

    const data = await response.json()
    const players = data?.response?.player_count

    res.status(200).json({
      players: Number.isFinite(players) ? players : null,
    })
  } catch (err) {
    console.error('[d2-players] fetch failed:', err?.message ?? err)
    res.status(502).json({ players: null, error: 'upstream_error' })
  } finally {
    clearTimeout(timeout)
  }
}