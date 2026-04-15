// ═══════════════════════════════════════════════════════════════
// NEXTGEN Bot — Configuration
// Server: 1410778472032370700
// ═══════════════════════════════════════════════════════════════

module.exports = {
  GUILD_ID: process.env.DISCORD_GUILD_ID || '1410778472032370700',

  CHANNELS: {
    // ── Onboarding ─────────────────────────────────────────
    WELCOME:            '1450106084147859529',
    VERIFY:             '1450093978727743488',
    RULES:              '1410778473756364841',
    GET_STARTED:        '1450093980896460842',
    START_HERE:         '1492635538589618269',
    INTRODUCTION:       '1492635976424751354',
    WHAT_IS_NEXTGEN:    '1410937987260354560',
    YOUR_PATH:          '1492636481221693530',

    // ── Community ──────────────────────────────────────────
    ANNOUNCEMENTS:      '1410778473756364842',
    GENERAL:            '1410778473756364845',
    FAQ:                '1450590295191457792',
    QUESTIONS:          '1492637326541590790',
    NETWORKING:         '1492637614392737902',
    GAMES:              '1438817965180059731',
    MEME:               '',
    WINS:               '1492637188817682442',
    CONTEST_SUBMISSION: '1491456083267420342',

    // ── X Engagement ──────────────────────────────────────
    X_TASKS:            '1411332259738554469',

    // ── Invites ────────────────────────────────────────────
    INVITE_TRACKING:    '1450208482350469253',

    // ── Content creation ───────────────────────────────────
    CONTENT_CREATION:   '1492640986025693255',

    // ── Elite ──────────────────────────────────────────────
    ELITE_START_HERE:   '1473345644310827253',
    ELITE_CHAT:         '1492641798718488738',
    ELITE_RESOURCES:    '1455456984194355232',
    ELITE_AI:           '1456312426562584818',
    ELITE_WEB3:         '1492640831163597062',
    ELITE_FREELANCING:  '1492641140149588138',
    ELITE_CONTENT:      '1492640986025693255',
    BUILD_IN_PUBLIC:    '1492641295859191819',
    ELITE_PROJECTS:     '1492641425995600114',
    ELITE_FEEDBACK:     '1492641537626996920',
    ELITE_OPPORTUNITIES:'1492641695370842242',
    ELITE_CHECKIN:      '1473344680182939659',
    ELITE_VC:           '1460335608202530849',
    WHY_ELITE:          '1492638554139004968',
    ELITE_PREVIEW:      '1492638906808795188',
    HOW_TO_JOIN_ELITE:  '1492639022668054689',

    // ── Design / Learning ─────────────────────────────────
    DESIGNER:           '1474333413363290182',
    DESIGNER_CHAT:      '1474726383228948551',
    AI_TUTOR:           '1478882761916809300',
    VIBE_CODING:        '1472703337467088957',

    // ── Voice ──────────────────────────────────────────────
    COMMUNITY_HANGOUT:  '1410778473756364849', // Lounge
    AMA_STAGE:          '1414642611762892801',

    // ── Staff ──────────────────────────────────────────────
    STAFF_ANNOUNCEMENT: '1465335978238541969',
    STAFF_CHAT:         '1465336091304394763',
    MOD_REPORT:         '1434929833472950324', // Command Center
  },

  // Bot NEVER posts in these
  BLOCKED_CHANNELS: [
    '1465335978238541969', // Staff Announcement (staff only)
  ],

  // Bot reads but doesn't casually chat in these
  SILENT_CHANNELS: [
    '1465335978238541969', // Staff Announcement
    '1450093980896460842', // Get Started (info only)
    '1492635538589618269', // Start Here
    '1410937987260354560', // What is Nextgen
    '1492636481221693530', // Your Path
    '1492638554139004968', // Why Elite
    '1492638906808795188', // Elite Preview
    '1492639022668054689', // How to Join Elite
    '1473345644310827253', // Elite Start Here
    '1455456984194355232', // Elite Resources
    '1410778473756364841', // Rules
    '1410778473756364842', // Announcements
  ],

  ROLES: {
    ADMIN:       process.env.ADMIN_ROLE_ID    || '',
    VERIFIED:    process.env.VERIFIED_ROLE_ID || '',
    ELITE:       '1434195823960264805',
    CONTRIBUTOR: process.env.CONTRIBUTOR_ROLE || '',
  },

  BOT_NAME:         'NEXTGEN',
  BOT_COLOR:        0x5865F2,
  COMMUNITY:        'NEXTGEN',
  BOT_CONTEXT:      process.env.BOT_CONTEXT || 'NEXTGEN — a community for builders, creators, and web3 learners. Features an Elite membership tier for serious builders.',

  X_ACCOUNT:        process.env.X_ACCOUNT           || '',
  X_BEARER:         process.env.TWITTER_BEARER_TOKEN || '',
  OFFICIAL_INVITE:  process.env.OFFICIAL_INVITE      || '',

  POINTS: { LIKE: 1, COMMENT: 2, RETWEET: 3, QUOTE: 3 },

  SAFE_DOMAINS: [
    'x.com','twitter.com','tenor.com','giphy.com','imgur.com',
    'youtube.com','youtu.be','github.com','linkedin.com',
    'media.discordapp.net','cdn.discordapp.com',
  ],

  PHISHING_PATTERNS: [
    /d[il1]sc[o0]rd[\-.]?(?:gift|nitro)/i,
    /free[\-\s]?n[i1]tro/i,
    /claim[\-\s]?(?:nitro|reward|gift)/i,
    /airdrop[\-\s]?(?:claim|free|reward)/i,
    /(?:discord|steam|roblox)[\-.](?:gift|promo|verify)\./i,
  ],

  TIMEOUTS: {
    FIRST:  5  * 60 * 1000,
    SECOND: 60 * 60 * 1000,
    THIRD:  24 * 60 * 60 * 1000,
  },

  X_POLL_INTERVAL_MS: 5 * 60 * 1000,

  CRONS: {
    STAFF_REMINDER:       '30 8 * * *',
    CONTRIBUTOR_MOTIVATE: '0 9 * * *',
    GENERAL_ENGAGE:       '0 */4 * * *',
    CONVO_STARTER:        '20 */3 * * *',
    CONTRIBUTOR_SUMMARY:  '0 8 * * *',
  },
};
