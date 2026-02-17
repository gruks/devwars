# Phase 5 Research: Stats & Ranking

**Researched:** February 17, 2026
**Domain:** Backend API, real-time updates, ranking systems
**Confidence:** HIGH

## Existing Implementation

### User Model (`backend/src/modules/users/user.model.js`)
- **Stats stored:** `wins`, `losses`, `matchesPlayed`, `rating` (default 1000)
- **Rating update method:** `updateStats(won)` — adds ±10 rating per match
- **Limitations:** Simple linear rating, no skill tiers, no time-based stats

### User Routes (`backend/src/modules/users/user.routes.js`)
- **GET /leaderboard** — Returns top 50 users by rating (no filters)
- **GET /:username** — Returns basic user profile

### Match Model (`backend/src/modules/matches/match.model.js`)
- **Stores:** roomId, questionId, status (waiting/active/finished), players, submissions, winner, timestamps
- **Timestamps:** `createdAt`, `updatedAt`, `startTime`, `endTime`
- **Indexes:** On roomId+status, status, playerId, createdAt

### Match Service (`backend/src/modules/matches/match.service.js`)
- Updates user stats in `endMatch()` via `user.updateStats(won)`
- No leaderboard broadcast after stats update

### Socket (`backend/src/socket/handlers/game.handler.js`)
- **Events:** MATCH_START, MATCH_END, PLAYER_SOLVED, TIMER_SYNC
- **Missing:** No LEADERBOARD_UPDATE event

---

## What Needs to Be Built

### 1. Profile API with Match History
**Gap:** GET /:username returns user but no match history

**Required:**
- Query matches where user was a player (via `players.playerId`)
- Include match details: question, scores, result, date
- Pagination (default 20, max 100)
- Sort by date (newest first)
- Optional filter by status (finished only)

**Match query approach:**
```javascript
// Efficient query using existing index on players.playerId
Match.find({ 'players.playerId': userId, status: 'finished' })
  .sort({ createdAt: -1 })
  .skip(offset)
  .limit(limit)
  .populate('questionId', 'title difficulty')
  .select('status players.score winner startTime endTime duration')
```

### 2. Leaderboard with Filters
**Gap:** Current leaderboard has no filters

**Required filters:**
| Filter | Query Parameter | Implementation |
|--------|-----------------|----------------|
| Time period | `?period=all\|daily\|weekly\|monthly` | Date filter on `createdAt` or match `endTime` |
| Skill level | `?tier=bronze\|silver\|gold\|platinum` | Rating range filter |
| Limit | `?limit=10\|50\|100` | Already supported |

**Time period queries:**
```javascript
const getPeriodFilter = (period) => {
  const now = new Date();
  switch (period) {
    case 'daily':
      return { $gte: new Date(now.setHours(0,0,0,0)) };
    case 'weekly':
      return { $gte: new Date(now.setDate(now.getDate() - 7)) };
    case 'monthly':
      return { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
    default:
      return {};
  }
};
```

**Tier ranges:**
| Tier | Rating Range |
|------|-------------|
| Bronze | 0-1099 |
| Silver | 1100-1299 |
| Gold | 1300-1599 |
| Platinum | 1600+ |

### 3. Dashboard Stats API
**Gap:** No global statistics endpoint

**Required metrics:**
```javascript
// Recommended aggregation pipeline
{
  totalMatches: Match.countDocuments({ status: 'finished' }),
  totalUsers: User.countDocuments({ role: 'user' }),
  activeToday: User.countDocuments({ 
    'lastActive': { $gte: todayStart }
  }),
  matchesToday: Match.countDocuments({ 
    status: 'finished',
    endTime: { $gte: todayStart }
  }),
  averageRating: User.aggregate([
    { $group: { _id: null, avg: { $avg: '$stats.rating' } } }
  ]),
  winRate: User.aggregate([
    { $project: { winRate: { $divide: ['$stats.wins', '$stats.matchesPlayed'] } } }
  ])
}
```

**Recommended endpoint:** `GET /api/v1/stats/dashboard`

### 4. Leaderboard Update Socket Event
**Gap:** No real-time leaderboard updates

**When to emit:**
1. After match ends (in `endMatch` service or socket handler)
2. Broadcast to all connected clients

**Implementation in `game.handler.js`:**
```javascript
// After match ends and stats are updated
const leaderboard = await User.find({ role: { $ne: 'admin' } })
  .select('username stats.rating stats.wins stats.losses')
  .sort({ 'stats.rating': -1 })
  .limit(50);

io.emit('LEADERBOARD_UPDATE', {
  type: 'LEADERBOARD_UPDATE',
  data: leaderboard
});
```

**Alternative:** Use the existing lobby namespace:
```javascript
io.to('lobby').emit('LEADERBOARD_UPDATE', { data: leaderboard });
```

### 5. Scoring Service Improvements
**Gap:** Current system uses fixed ±10 rating

**Option A: Simple ELO (Recommended)
```javascript
// ELO rating calculation
const K_FACTOR = 32; // Volatility factor

const calculateElo = (winnerRating, loserRating) => {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
  
  return {
    winnerGain: Math.round(K_FACTOR * (1 - expectedWinner)),
    loserLoss: Math.round(K_FACTOR * (0 - expectedLoser))
  };
};
```

**Option B: Keep current with bonus modifiers**
- First blood bonus: +5 rating
- Perfect score (100%): +5 rating
- Speed bonus: +1 to +5 based on solve time

**Recommendation:** Use ELO with K=32 for balanced progression. Current ±10 is acceptable for casual play but ELO provides better matchmaking potential.

---

## Recommended Approach

### Phase 5A: User Profile with Match History
1. Add new route: `GET /:username/history`
2. Create service method: `getUserMatchHistory(userId, options)`
3. Add pagination middleware
4. Return match details with player scores

### Phase 5B: Leaderboard Filters
1. Extend existing `/leaderboard` route with query params
2. Add period and tier filters
3. Add caching (optional): Redis TTL 60 seconds

### Phase 5C: Dashboard Stats
1. New route: `GET /api/v1/stats/dashboard`
2. Create stats service with aggregation
3. Cache results (5 min TTL)

### Phase 5D: Socket Events
1. Add `LEADERBOARD_UPDATE` event emission in `match:end` socket handler
2. Or emit in `endMatch` service after stats update

### Phase 5E: Scoring Improvements
1. Replace `updateStats` with ELO calculation
2. Add rating to user response
3. Document new rating behavior

---

## Key Decisions to Make

1. **Rating system choice:**
   - Keep ±10 fixed (simple, no stratification)
   - Use ELO (better matchmaking, more accurate)
   - Use ELO + bonuses (first blood, speed)

2. **Leaderboard caching:**
   - No cache (always fresh)
   - In-memory cache (60s TTL)
   - Redis cache (for scalability)

3. **Match history visibility:**
   - Public: anyone can view any user's history
   - Private: users can only see their own history
   - Friends-only: future feature

4. **Dashboard access:**
   - Public (anyone can see global stats)
   - Authenticated only (prevent abuse)
   - Admin only (detailed metrics)

---

## Code Examples

### Leaderboard with Filters (Recommended Pattern)
```javascript
// backend/src/modules/users/user.routes.js
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'all', tier, limit = 50 } = req.query;
    
    // Build query
    const query = { role: { $ne: 'admin' } };
    
    // Period filter (requires match timestamps, not user createdAt)
    if (period !== 'all') {
      const now = new Date();
      let startDate;
      switch (period) {
        case 'daily': startDate = new Date(now.setHours(0,0,0,0)); break;
        case 'weekly': startDate = new Date(now.setDate(now.getDate() - 7)); break;
        case 'monthly': startDate = new Date(now.setMonth(now.getMonth() - 1)); break;
      }
      // Note: Would need to query matches to get users who played in period
      // For now, filter by user stats update time or keep simple
    }
    
    // Tier filter
    const tierRanges = {
      bronze: { $lt: 1100 },
      silver: { $gte: 1100, $lt: 1300 },
      gold: { $gte: 1300, $lt: 1600 },
      platinum: { $gte: 1600 }
    };
    if (tier && tierRanges[tier]) {
      query['stats.rating'] = tierRanges[tier];
    }
    
    const users = await User.find(query)
      .select('username stats.rating stats.wins stats.losses stats.matchesPlayed')
      .sort({ 'stats.rating': -1 })
      .limit(Math.min(parseInt(limit), 100));
    
    // Add rank
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      rating: user.stats.rating,
      wins: user.stats.wins,
      losses: user.stats.losses,
      winRate: user.stats.matchesPlayed > 0 
        ? (user.stats.wins / user.stats.matchesPlayed * 100).toFixed(1) + '%'
        : '0%'
    }));
    
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### User Profile with Match History
```javascript
// backend/src/modules/users/user.routes.js
router.get('/:username/history', async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20, status = 'finished' } = req.query;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const matches = await Match.find({
      'players.playerId': user._id,
      status: status || 'finished'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(parseInt(limit), 100))
      .populate('questionId', 'title difficulty')
      .select('status startTime endTime duration players winner');
    
    const history = matches.map(match => {
      const player = match.players.find(
        p => p.playerId.toString() === user._id.toString()
      );
      return {
        matchId: match._id,
        question: match.questionId,
        result: match.winner?.playerId.toString() === user._id.toString() ? 'win' : 'loss',
        score: player?.score || 0,
        solvedAt: player?.solvedAt,
        startTime: match.startTime,
        endTime: match.endTime,
        duration: match.duration
      };
    });
    
    const total = await Match.countDocuments({
      'players.playerId': user._id,
      status: status || 'finished'
    });
    
    res.json({
      success: true,
      data: {
        history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: Match model, User model, routes, services
- Socket.io documentation patterns

### Secondary (MEDIUM confidence)
- ELO rating system: Standard competitive gaming implementation
- RESTful pagination patterns: Industry standard

### Tertiary (LOW confidence)
- Leaderboard caching strategies: Would need validation for scale

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Express/Mongoose/Socket.io
- Architecture: HIGH - Follows existing service/route pattern
- Pitfalls: MEDIUM - Date filtering requires match timestamps, pagination needs validation
- Scoring: MEDIUM - ELO is standard but needs tuning for game pace

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (6 months for stable patterns)
