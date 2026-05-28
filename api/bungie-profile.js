// api/bungie-profile.js
// Fetches profile data for a given membershipId + membershipType.
// Query: ?membershipId=...&membershipType=...

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')

  const { membershipId, membershipType } = req.query
  if (!membershipId || !membershipType) {
    return res.status(400).json({ error: 'membershipId and membershipType are required' })
  }

  const apiKey = process.env.BUNGIE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'BUNGIE_API_KEY not set' })

  try {
    // Components:
    //  100 = Profiles       (dateLastPlayed, seasonPassProgressionScope)
    //  200 = Characters     (class, race, light/power, minutesPlayedTotal)
    //  900 = Records        (score = Triumph score)
    const profileUrl =
      `https://www.bungie.net/Platform/Destiny2/${membershipType}/Profile/${membershipId}/` +
      `?components=100,200,900`

    const [profileRes, clanRes] = await Promise.all([
      fetch(profileUrl, { headers: { 'X-API-Key': apiKey } }),
      fetch(
        `https://www.bungie.net/Platform/GroupV2/User/${membershipType}/${membershipId}/0/1/`,
        { headers: { 'X-API-Key': apiKey } }
      ),
    ])

    const profileData = await profileRes.json()
    const clanData    = await clanRes.json()

    if (profileData.ErrorCode !== 1) {
      return res.status(502).json({ error: profileData.Message || 'Bungie API error' })
    }

    const profile    = profileData.Response?.profile?.data
    const characters = profileData.Response?.characters?.data || {}
    const records    = profileData.Response?.profileRecords?.data

    // ── Characters ────────────────────────────────────────────────────────────
    const CLASS_MAP = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock', 3: 'Unknown' }
    const RACE_MAP  = { 0: 'Human', 1: 'Awoken', 2: 'Exo',     3: 'Unknown' }
    const GENDER_MAP = { 0: 'Male', 1: 'Female', 2: 'Unknown' }

    const charList = Object.values(characters)
      .sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))
      .map(c => ({
        characterId:    c.characterId,
        class:          CLASS_MAP[c.classType] ?? 'Unknown',
        race:           RACE_MAP[c.raceType]   ?? 'Unknown',
        gender:         GENDER_MAP[c.genderType] ?? 'Unknown',
        light:          c.light,
        level:          c.baseCharacterLevel,
        minutesPlayed:  parseInt(c.minutesPlayedTotal || '0'),
        dateLastPlayed: c.dateLastPlayed,
        emblemPath:     c.emblemPath,
        emblemBackgroundPath: c.emblemBackgroundPath,
      }))

    // ── Total playtime across all characters ──────────────────────────────────
    const totalMinutes = charList.reduce((sum, c) => sum + c.minutesPlayed, 0)

    // ── Triumph score ─────────────────────────────────────────────────────────
    const triumphScore = records?.score ?? null
    const activeScore  = records?.activeScore ?? null

    // ── Clan ──────────────────────────────────────────────────────────────────
    let clan = null
    if (clanData.ErrorCode === 1) {
      const results = clanData.Response?.results || []
      const clanResult = results.find(r => r.group?.groupType === 1)
      if (clanResult) {
        clan = {
          name:    clanResult.group.name,
          motto:   clanResult.group.motto,
          members: clanResult.group.memberCount,
        }
      }
    }

    // ── Last played (most recent across all chars) ────────────────────────────
    const dateLastPlayed = profile?.dateLastPlayed ?? charList[0]?.dateLastPlayed ?? null

    res.status(200).json({
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