// api/bungie-search.js
// Searches for a Bungie player by display name and returns membershipId + type.
// Query: ?name=Guardian%231234

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const { name } = req.query
  if (!name) return res.status(400).json({ error: 'name is required' })

  const apiKey = process.env.BUNGIE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'BUNGIE_API_KEY not set' })

  try {
    // SearchDestinyPlayerByBungieName — accepts "name#code" format
    const [displayName, displayNameCode] = name.split('#')
    if (!displayName) return res.status(400).json({ error: 'invalid name format' })

    const searchRes = await fetch(
      'https://www.bungie.net/Platform/Destiny2/SearchDestinyPlayerByBungieName/-1/',
      {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName,
          displayNameCode: displayNameCode ? parseInt(displayNameCode) : undefined,
        }),
      }
    )

    const data = await searchRes.json()

    if (data.ErrorCode !== 1) {
      return res.status(502).json({ error: data.Message || 'Bungie API error' })
    }

    const results = (data.Response || []).map(p => ({
      membershipId:   p.membershipId,
      membershipType: p.membershipType,
      displayName:    p.bungieGlobalDisplayName,
      displayCode:    p.bungieGlobalDisplayNameCode,
      iconPath:       p.iconPath,
    }))

    res.status(200).json({ results })
  } catch (err) {
    console.error('[bungie-search]', err)
    res.status(502).json({ error: 'upstream_error' })
  }
}