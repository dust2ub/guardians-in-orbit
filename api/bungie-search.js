// api/bungie-search.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const { name } = req.query
  if (!name) return res.status(400).json({ error: 'name is required' })

  const apiKey = process.env.BUNGIE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'BUNGIE_API_KEY not set' })

  try {
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

    // For each result, also fetch the linked Bungie.net membership ID
    const rawResults = data.Response || []

    const results = await Promise.all(
      rawResults.map(async p => {
        let bungieNetMembershipId = null

        try {
          const membershipsRes = await fetch(
            `https://www.bungie.net/Platform/User/GetMembershipsById/${p.membershipId}/${p.membershipType}/`,
            { headers: { 'X-API-Key': apiKey } }
          )
          const membershipsData = await membershipsRes.json()

          console.log('[bungie-search] membershipsData:', JSON.stringify(membershipsData.Response, null, 2))
          
          bungieNetMembershipId =
            membershipsData.Response?.bungieNetUser?.membershipId ?? null
        } catch (_) {
          // non-fatal: firstAccess will just be null
        }

        return {
          membershipId:          p.membershipId,
          membershipType:        p.membershipType,
          bungieNetMembershipId, // ← needed for GetBungieNetUserById
          displayName:           p.bungieGlobalDisplayName,
          displayCode:           p.bungieGlobalDisplayNameCode,
          iconPath:              p.iconPath,
        }
      })
    )

    res.status(200).json({ results })
  } catch (err) {
    console.error('[bungie-search]', err)
    res.status(502).json({ error: 'upstream_error' })
  }
}