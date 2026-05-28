// api/bungie-profile.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')

  const { membershipId, membershipType, bungieNetMembershipId } = req.query
  if (!membershipId || !membershipType) {
    return res.status(400).json({ error: 'membershipId and membershipType are required' })
  }

  const apiKey = process.env.BUNGIE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'BUNGIE_API_KEY not set' })

  try {
    const profileUrl =
      `https://www.bungie.net/Platform/Destiny2/${membershipType}/Profile/${membershipId}/` +
      `?components=100,200,900`

    // Fire all requests in parallel; bungieNetUser is optional
    const fetches = [
      fetch(profileUrl, { headers: { 'X-API-Key': apiKey } }),
      fetch(
        `https://www.bungie.net/Platform/GroupV2/User/${membershipType}/${membershipId}/0/1/`,
        { headers: { 'X-API-Key': apiKey } }
      ),
    ]

    if (bungieNetMembershipId) {
      fetches.push(
        fetch(
          `https://www.bungie.net/Platform/User/GetBungieNetUserById/${bungieNetMembershipId}/`,
          { headers: { 'X-API-Key': apiKey } }
        )
      )
    }

    const [profileRes, clanRes, bungieUserRes] = await Promise.all(fetches)

    const profileData = await profileRes.json()
    const clanData    = await clanRes.json()
    const bungieUserData = bungieUserRes ? await bungieUserRes.json() : null

    if (profileData.ErrorCode !== 1) {
      return res.status(502).json({ error: profileData.Message || 'Bungie API error' })
    }

    const profile    = profileData.Response?.profile?.data
    const characters = profileData.Response?.characters?.data || {}
    const records    = profileData.Response?.profileRecords?.data

    // ── firstAccess from Bungie.net user ─────────────────────────────────────
    const firstAccess =
      bungieUserData?.ErrorCode === 1
        ? (bungieUserData.Response?.firstAccess ?? null)
        : null

    // ── Characters ────────────────────────────────────────────────────────────
    const CLASS_MAP  = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock', 3: 'Unknown' }
    const RACE_MAP   = { 0: 'Human', 1: 'Awoken', 2: 'Exo',     3: 'Unknown' }
    const GENDER_MAP = { 0: 'Male',  1: 'Female', 2: 'Unknown' }

    const charList = Object.values(characters)
      .sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))
      .map(c => ({
        characterId:          c.characterId,
        class:                CLASS_MAP[c.classType]  ?? 'Unknown',
        race:                 RACE_MAP[c.raceType]    ?? 'Unknown',
        gender:               GENDER_MAP[c.genderType] ?? 'Unknown',
        light:                c.light,
        level:                c.baseCharacterLevel,
        minutesPlayed:        parseInt(c.minutesPlayedTotal || '0'),
        dateLastPlayed:       c.dateLastPlayed,
        emblemPath:           c.emblemPath,
        emblemBackgroundPath: c.emblemBackgroundPath,
      }))

    const totalMinutes = charList.reduce((sum, c) => sum + c.minutesPlayed, 0)
    const triumphScore = records?.score       ?? null
    const activeScore  = records?.activeScore ?? null

    // ── Clan ──────────────────────────────────────────────────────────────────
    let clan = null
    if (clanData.ErrorCode === 1) {
      const results    = clanData.Response?.results || []
      const clanResult = results.find(r => r.group?.groupType === 1)
      if (clanResult) {
        clan = {
          name:    clanResult.group.name,
          motto:   clanResult.group.motto,
          members: clanResult.group.memberCount,
        }
      }
    }

    const dateLastPlayed = profile?.dateLastPlayed ?? charList[0]?.dateLastPlayed ?? null

    res.status(200).json({
      firstAccess,      // ← new
      dateLastPlayed,
      totalMinutes,
      triumphScore,
      activeScore,
      characters: charList,
      clan,
    })
  } catch (err) {
    console.error('[bungie-profile]', err)
    res.status(502).json({ error: 'upstream_error' })
  }
}