// ═══════════════════════════════════════════════════════════════
// NEXTGEN Bot — Configuration
// Server: 1410778472032370700
// ═══════════════════════════════════════════════════════════════

module.exports = {
  GUILD_ID: process.env.DISCORD_GUILD_ID || '1410778472032370700',

  CHANNELS: {
    WELCOME:          process.env.CH_WELCOME          || '1450106084147859529',
    LOG:              process.env.CH_LOG               || '1410803080374649005',
    GENERAL:          process.env.CH_GENERAL           || '',
    RULES:            process.env.CH_RULES             || '',
    INTRODUCTION:     process.env.CH_INTRODUCTION      || '',
    VERIFY:           process.env.CH_VERIFY            || '',
    ANNOUNCEMENTS:    process.env.CH_ANNOUNCEMENTS     || '',
    MOD_REPORT:       process.env.CH_MOD_REPORT        || '1410803080374649005',
    STAFF_CHAT:       process.env.CH_STAFF_CHAT        || '',
    GM_GN:            process.env.CH_GMGN              || '',
    X_TASKS:          process.env.CH_X_TASKS           || '',
    MEME:             process.env.CH_MEME              || '',
    CONTENT_CREATION: process.env.CH_CONTENT           || '',
    CONTRIBUTOR_CHAT: process.env.CH_CONTRIBUTOR_CHAT  || '',
    CONTRIBUTOR_RPT:  process.env.CH_CONTRIBUTOR_RPT   || '',
    COMMUNITY_HANGOUT:process.env.CH_HANGOUT           || '',
    MINI_UPDATES:     process.env.CH_MINI_UPDATES      || '',
    INVITE_TRACKING:  process.env.CH_INVITES           || '',
    SUPPORT:          process.env.CH_SUPPORT           || '',
    BLOCKED: [],
  },

  // Channels the bot never sends messages in
  BLOCKED_CHANNELS: (process.env.BLOCKED_CHANNELS || '').split(',').filter(Boolean),

  // Channels that are read-only (bot listens but doesn't chat)
  SILENT_CHANNELS: (process.env.SILENT_CHANNELS || '').split(',').filter(Boolean),

  ROLES: {
    ADMIN:       process.env.ADMIN_ROLE_ID    || '',
    VERIFIED:    process.env.VERIFIED_ROLE_ID || '',
    CONTRIBUTOR: process.env.CONTRIBUTOR_ROLE || '',
    MUTED:       process.env.MUTED_ROLE       || '',
  },

  // Bot identity — filled via env so no rebuild needed when customizing
  BOT_NAME:    process.env.BOT_NAME    || 'NEXTGEN',
  BOT_COLOR:   parseInt(process.env.BOT_COLOR || '5865F2', 16),
  COMMUNITY:   process.env.COMMUNITY_NAME || 'NEXTGEN',

  // X / Twitter
  X_ACCOUNT:        process.env.X_ACCOUNT        || '',
  X_BEARER:         process.env.TWITTER_BEARER_TOKEN || '',
  OFFICIAL_INVITE:  process.env.OFFICIAL_INVITE  || '',

  // Points
  POINTS: { LIKE: 1, COMMENT: 2, RETWEET: 3, QUOTE: 3 },

  // Safe domains (never delete links from these)
  SAFE_DOMAINS: [
    'x.com','twitter.com','tenor.com','giphy.com','imgur.com',
    'youtube.com','youtu.be','github.com','linkedin.com',
    'media.discordapp.net','cdn.discordapp.com',
  ],

  // Phishing patterns
  PHISHING_PATTERNS: [
    /d[il1]sc[o0]rd[\-.]?(?:gift|nitro)/i,
    /free[\-\s]?n[i1]tro/i,
    /claim[\-\s]?(?:nitro|reward|gift)/i,
    /airdrop[\-\s]?(?:claim|free|reward)/i,
    /(?:discord|steam|roblox)[\-.](?:gift|promo|verify)\./i,
  ],

  // Timeout durations
  TIMEOUTS: {
    FIRST:  5  * 60 * 1000,
    SECOND: 60 * 60 * 1000,
    THIRD:  24 * 60 * 60 * 1000,
  },

  X_POLL_INTERVAL_MS: 5 * 60 * 1000,

  // Crons
  CRONS: {
    STAFF_REMINDER:        process.env.CRON_STAFF    || '30 8 * * *',
    CONTRIBUTOR_MOTIVATE:  process.env.CRON_CONTRIB  || '0 9 * * *',
    GENERAL_ENGAGE:        process.env.CRON_ENGAGE   || '0 */4 * * *',
    CONVO_STARTER:         process.env.CRON_CONVO    || '20 */3 * * *',
    CONTRIBUTOR_SUMMARY:   process.env.CRON_SUMMARY  || '0 8 * * *',
    GAME_NIGHT_ANNOUNCE:   process.env.CRON_GAME     || '0 9 * * 2,4,5',
    GAME_NIGHT_REMINDER:   process.env.CRON_GAME_REM || '30 14 * * 2,4,5',
    XSPACE_REMINDER:       process.env.CRON_XSPACE   || '0 9 * * 3',
  },
};
