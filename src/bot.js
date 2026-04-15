// ═══════════════════════════════════════════════════════════════
//
//   NEXTGEN — Community Manager & Moderator Bot
//   Built on the QANAT Bot framework
//   All features: AI chat, moderation, X tasks, invites, VC
//
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const {
  Client, GatewayIntentBits, Partials,
  EmbedBuilder, PermissionFlagsBits, Collection,
  REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const {
  joinVoiceChannel, getVoiceConnection,
  VoiceConnectionStatus, entersState, EndBehaviorType,
} = require('@discordjs/voice');

const cron     = require('node-cron');
const config   = require('./config');
const { queries: q, awardPoints, recordEngagement, recordInvite } = require('./db');
const { matchFAQ, getAllFAQ } = require('./faq');
const { startXMonitor, handleTweetLink } = require('./xmonitor');
const ai       = require('./ai');

// ── Client ────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

// ── VC sessions ───────────────────────────────────────────────
const vcSessions = new Map();

// ── Invite cache ──────────────────────────────────────────────
const inviteCache = new Collection();

// ── Cooldowns ────────────────────────────────────────────────
const cooldowns = new Map();
function isOnCooldown(key, sec = 30) {
  const now = Date.now();
  if (cooldowns.has(key) && now - cooldowns.get(key) < sec * 1000) return true;
  cooldowns.set(key, now);
  return false;
}

function isAdmin(member) {
  if (!member) return false;
  return (config.ROLES.ADMIN && member.roles?.cache?.has(config.ROLES.ADMIN)) ||
    member.permissions?.has(PermissionFlagsBits.Administrator);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ═══════════════════════════════════════════════════════════════
// READY
// ═══════════════════════════════════════════════════════════════

client.once('ready', async () => {
  console.log(`\n  ${config.BOT_NAME} Bot online as ${client.user.tag}`);
  console.log(`  AI: ${ai.isAIEnabled() ? 'enabled' : 'DISABLED'}`);
  console.log(`  Guild: ${config.GUILD_ID}`);
  console.log(`  ${new Date().toISOString()}\n`);

  // Register slash commands
  try {
    const commands = require('./commands');
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, config.GUILD_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log(`  Registered ${commands.length} slash commands`);
  } catch (err) { console.error('  Cmd registration failed:', err.message); }

  // Cache invites
  try {
    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (guild) {
      const invites = await guild.invites.fetch();
      invites.forEach(inv => inviteCache.set(inv.code, inv.uses));
      console.log(`  Cached ${invites.size} invites`);
    }
  } catch {}

  startXMonitor(client);
  startScheduledTasks();
  await setupVerification(client);

  client.user.setPresence({
    activities: [{ name: `${config.COMMUNITY} Community`, type: 3 }],
    status: 'online',
  });
});

// ═══════════════════════════════════════════════════════════════
// VERIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════

async function setupVerification(client) {
  const guild = client.guilds.cache.get(config.GUILD_ID);
  if (!guild || !config.CHANNELS.VERIFY) return;

  const ch = guild.channels.cache.get(config.CHANNELS.VERIFY);
  if (!ch) return;

  try {
    const messages = await ch.messages.fetch({ limit: 20 });
    const existing = messages.find(m => m.author.id === client.user.id && m.components.length > 0);
    if (existing) { console.log('  Verify message exists'); return; }
  } catch {}

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ng_verify')
      .setLabel('Verify')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  );

  await ch.send({
    content: `**Welcome to ${config.COMMUNITY}**\n\nClick the button below to verify and unlock full access to the server.`,
    components: [row],
  });
  console.log('  Verification message posted');
}

// ═══════════════════════════════════════════════════════════════
// MEMBER JOIN
// ═══════════════════════════════════════════════════════════════

client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;
  q.upsertMember.run(member.id, member.user.username);

  const welcomeChannelId = config.CHANNELS.WELCOME;
  if (welcomeChannelId) {
    const ch = member.guild.channels.cache.get(welcomeChannelId);
    if (ch) {
      const welcomes = [
        `Hey <@${member.id}>, welcome to ${config.COMMUNITY}! Good to have you here.\n\nIntroduce yourself${config.CHANNELS.INTRODUCTION ? ` in <#${config.CHANNELS.INTRODUCTION}>` : ''} and get verified${config.CHANNELS.VERIFY ? ` in <#${config.CHANNELS.VERIFY}>` : ''} to unlock everything. If you have questions, just ask.`,
        `<@${member.id}> just joined, welcome! ${config.CHANNELS.VERIFY ? `Head over to <#${config.CHANNELS.VERIFY}> to get verified` : 'Check the channels to get started'} and make yourself at home.`,
        `Welcome <@${member.id}>! Glad you're here. Take a look around and${config.CHANNELS.INTRODUCTION ? ` drop an intro in <#${config.CHANNELS.INTRODUCTION}>` : ' say hi'}. We're friendly around here.`,
      ];
      await ch.send(pick(welcomes));
    }
  }

  // Welcome DM
  try {
    await member.user.send(
      `Hey ${member.user.displayName}, welcome to **${config.COMMUNITY}**!\n\n` +
      `We're glad you joined. ${config.CHANNELS.VERIFY ? 'Get verified to unlock all channels.' : 'Check the channels to get started.'}\n\n` +
      `If you have any questions, just ask in the server or ping a staff member. See you around.`
    );
  } catch {}

  // Invite tracking
  try {
    const newInvites = await member.guild.invites.fetch();
    const used = newInvites.find(inv => (inviteCache.get(inv.code) || 0) < inv.uses);
    newInvites.forEach(inv => inviteCache.set(inv.code, inv.uses));
    if (used?.inviter) {
      q.upsertMember.run(used.inviter.id, used.inviter.username);
      recordInvite(used.inviter.id, member.id, used.code);
      const count = q.getMember.get(used.inviter.id)?.invite_count || 1;
      const invCh = member.guild.channels.cache.get(config.CHANNELS.INVITE_TRACKING);
      if (invCh) {
        await invCh.send(`**${member.user.displayName}** joined through <@${used.inviter.id}>'s invite. That's ${count} total.`);
      }
    }
  } catch {}

  logModAction(member.guild, null, 'member_join', `${member.user.tag} joined`);
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE CREATE
// ═══════════════════════════════════════════════════════════════

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const channelId = message.channel.id;
  if (config.BLOCKED_CHANNELS.includes(channelId)) return;

  const content  = message.content;
  const lower    = content.toLowerCase().trim();
  const isAdm    = isAdmin(message.member);
  const name     = message.member?.displayName || message.author.displayName;

  q.upsertMember.run(message.author.id, message.author.username);
  ai.addToBuffer(channelId, name, content, false);

  // X task detection
  if (channelId === config.CHANNELS.X_TASKS) {
    const handled = await handleTweetLink(message);
    if (handled) return;
  }

  // GM/GN channel
  if (channelId === config.CHANNELS.GM_GN) {
    await handleGMGN(message, lower, isAdm);
    return;
  }

  // Moderation (skip admins)
  if (!isAdm) {
    if (await handlePhishing(message)) return;
    await handleQuickMod(message, lower);
  }

  // Reactions
  if (channelId === config.CHANNELS.MEME && (message.attachments.size > 0 || /https?:\/\//.test(content))) {
    await message.react('😂');
  }
  if (channelId === config.CHANNELS.CONTENT_CREATION && (message.attachments.size > 0 || /https?:\/\//.test(content))) {
    await message.react('🔥');
  }

  // AI conversation (all channels except silent)
  if (!config.SILENT_CHANNELS.includes(channelId)) {
    await handleConversation(message, channelId, lower, name);
  }
});

// ── GM/GN Handler ─────────────────────────────────────────────
async function handleGMGN(message, lower, isAdm) {
  if (/\bgm\b|good\s*morning/i.test(lower)) {
    await message.react('☀️');
    q.upsertStreak.run(message.author.id, 'gm');
    const s = q.getStreak.get(message.author.id, 'gm');
    if (s?.streak_count > 0 && s.streak_count % 7 === 0) {
      await message.reply(`${s.streak_count} days straight. Respect.`);
    }
  } else if (/\bgn\b|good\s*night/i.test(lower)) {
    await message.react('🌙');
    q.upsertStreak.run(message.author.id, 'gn');
  } else if (!isAdm) {
    await message.reply(`This channel is just for GM and GN.${config.CHANNELS.GENERAL ? ` Chat in <#${config.CHANNELS.GENERAL}>.` : ''}`);
  }
}

// ── Phishing detection ────────────────────────────────────────
async function handlePhishing(message) {
  const urls = message.content.match(/https?:\/\/[^\s<]+/gi);
  if (!urls) return false;

  for (const url of urls) {
    const ul = url.toLowerCase();
    const safe = config.SAFE_DOMAINS.some(d => { try { const h = new URL(ul).hostname; return h === d || h.endsWith('.' + d); } catch { return ul.includes(d); } });
    if (safe) continue;
    if (config.OFFICIAL_INVITE && (ul.includes(`discord.gg/${config.OFFICIAL_INVITE}`) || ul.includes(`discord.com/invite/${config.OFFICIAL_INVITE}`))) continue;

    const isPhishing = config.PHISHING_PATTERNS.some(p => p.test(ul));
    const isInvite   = /discord\.gg\/|discord\.com\/invite\//i.test(ul);

    if (isPhishing || isInvite) {
      try {
        await message.delete();
        const offenses = q.getRecentOffenses.get(message.author.id);
        const count = offenses?.count || 0;
        let ms, label;
        if (count >= 2) { ms = config.TIMEOUTS.THIRD;  label = '24 hours'; }
        else if (count >= 1) { ms = config.TIMEOUTS.SECOND; label = '1 hour'; }
        else { ms = config.TIMEOUTS.FIRST; label = '5 minutes'; }
        try { await message.member.timeout(ms, 'Suspicious link'); } catch {}
        const warn = await message.channel.send(
          `Removed a suspicious link from <@${message.author.id}>. Timed out for ${label}.` +
          (count >= 2 && config.ROLES.ADMIN ? ` <@&${config.ROLES.ADMIN}> repeat offense.` : '')
        );
        setTimeout(() => warn.delete().catch(() => {}), 30_000);
        logModAction(message.guild, message.author.id, 'phishing_delete', `${isPhishing?'Phishing':'Unauthorized invite'} in #${message.channel.name}. Timeout: ${label}.`, message.channel.id);
        return true;
      } catch {}
    }
  }
  return false;
}

// ── Quick moderation ──────────────────────────────────────────
async function handleQuickMod(message, lower) {
  const name = message.member?.displayName || '';

  // Impersonation
  if (/\b(staff|support|admin|moderator)\b/i.test(name.toLowerCase())) {
    await warnMember(message, 12, 'serious', 'Your display name contains restricted words. Change it or you will be removed.');
    return;
  }

  // NSFW
  if (/\b(porn|hentai|nude|naked|xxx|onlyfans)\b/i.test(lower)) {
    await message.delete().catch(() => {});
    await warnMember(message, 5, 'serious', 'That kind of content is not allowed here.', true);
    return;
  }

  // Begging
  if (/\b(send me|give me|donate to me|send crypto|send eth|send btc|i need \$)\b/i.test(lower)) {
    await warnMember(message, 10, 'moderate', 'Asking for money or crypto is not allowed here.');
    return;
  }

  // Mass mentions
  if ((message.content.match(/<@&?\d+>/g) || []).length > 5) {
    await message.delete().catch(() => {});
    await warnMember(message, 7, 'moderate', 'Too many tags in one message. Only tag staff for real emergencies.', true);
    return;
  }

  // Hate speech
  if (/\b(n[i1]gg|f[a4]gg|k[yi]ke)\b/i.test(lower)) {
    await message.delete().catch(() => {});
    await warnMember(message, 1, 'serious', 'That language is not tolerated here.', true);
  }
}

async function warnMember(message, rule, severity, warning, deleted = false) {
  const offenses = q.getRecentOffenses.get(message.author.id);
  const count    = (offenses?.count || 0) + 1;

  let timeoutMs = 0, label = '';
  if (severity === 'serious' || count >= 3) {
    timeoutMs = count >= 4 ? config.TIMEOUTS.THIRD : count >= 3 ? config.TIMEOUTS.SECOND : config.TIMEOUTS.FIRST;
    label = count >= 4 ? '24 hours' : count >= 3 ? '1 hour' : '5 minutes';
    try { await message.member.timeout(timeoutMs, `Rule ${rule}`); } catch {}
  }

  const txt = timeoutMs
    ? `<@${message.author.id}> ${warning} Timed out for ${label}. (Rule ${rule})`
    : `<@${message.author.id}> ${warning} (Rule ${rule})`;

  const warn = await message.channel.send(txt).catch(() => null);
  if (warn) setTimeout(() => warn.delete().catch(() => {}), 60_000);

  const modCh = message.guild.channels.cache.get(config.CHANNELS.MOD_REPORT);
  if (modCh) {
    await modCh.send(
      `**Rule ${rule}** (${severity}) ${config.ROLES.ADMIN && count >= 2 ? `<@&${config.ROLES.ADMIN}>` : ''}\n` +
      `User: <@${message.author.id}> | Channel: #${message.channel.name} | Offense #${count}\n` +
      `Action: ${timeoutMs ? `Timeout ${label}` : 'Warning'}\n` +
      `${deleted ? 'Message deleted. ' : ''}${warning}`
    ).catch(() => {});
  }
  logModAction(message.guild, message.author.id, timeoutMs ? 'timeout' : 'warning',
    `Rule ${rule} in #${message.channel.name}. ${warning}`, message.channel.id);
}

// ── AI Conversation ───────────────────────────────────────────
async function handleConversation(message, channelId, lower, name) {
  const mentioned = message.mentions.has(client.user);
  if (!mentioned && !ai.shouldRespond(message, channelId)) return;

  try {
    const response = await ai.generateResponse(channelId, name, message.content);
    if (response) {
      ai.recordResponse(channelId, message.author.id);
      ai.addToBuffer(channelId, config.BOT_NAME, response, true);
      if (mentioned) await message.reply(response);
      else await message.channel.send(response);
    }
  } catch (err) { console.error('[Chat] Error:', err.message); }
}

// ═══════════════════════════════════════════════════════════════
// REACTIONS — X Engagement
// ═══════════════════════════════════════════════════════════════

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
  if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }
  const msg = reaction.message;
  if (!config.CHANNELS.X_TASKS || msg.channel.id !== config.CHANNELS.X_TASKS) return;
  if (msg.author.id !== client.user.id) return;

  q.upsertMember.run(user.id, user.username);
  const member = q.getMember.get(user.id);
  if (!member?.x_verified) {
    if (!isOnCooldown(`linkx-dm-${user.id}`, 3600)) {
      try { await user.send('Link your X account first with /linkx.'); } catch {}
    }
    return;
  }

  const emoji = reaction.emoji.name;
  const db    = require('./db').db;
  const tweet = db.prepare('SELECT tweet_id FROM x_tweets WHERE message_id = ?').get(msg.id);
  if (!tweet) return;

  if (emoji === '⭐') {
    let earned = 0;
    for (const [a, p] of [['like',1],['comment',2],['retweet',3]]) {
      if (recordEngagement(user.id, tweet.tweet_id, a, p)) earned += p;
    }
    if (earned > 0) {
      const total = q.getPoints.get(user.id);
      try { await user.send(`+${earned} points for full engagement. Total: ${total?.total_points} pts.`); } catch {}
    }
    return;
  }

  const map = { '👍': ['like',1], '💬': ['comment',2], '🔄': ['retweet',3] };
  if (!map[emoji]) return;
  const [action, pts] = map[emoji];
  if (recordEngagement(user.id, tweet.tweet_id, action, pts)) {
    const total = q.getPoints.get(user.id);
    try { await user.send(`+${pts} for the ${action}. Total: ${total?.total_points} pts.`); } catch {}
  }
});

// ── Invite tracking ───────────────────────────────────────────
client.on('inviteCreate', inv => inviteCache.set(inv.code, inv.uses));
client.on('inviteDelete', inv => inviteCache.delete(inv.code));

// ── Voice state ───────────────────────────────────────────────
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member?.id === client.user?.id) return;

  const hangoutId = config.CHANNELS.COMMUNITY_HANGOUT;
  if (!hangoutId) return;

  // Auto-join when 2+ people in hangout
  if (newState.channelId === hangoutId && !vcSessions.has(newState.guild.id)) {
    const ch = newState.guild.channels.cache.get(hangoutId);
    if (ch && ch.members.filter(m => !m.user.bot).size >= 2) {
      try {
        const conn = joinVoiceChannel({ channelId: hangoutId, guildId: newState.guild.id, adapterCreator: newState.guild.voiceAdapterCreator, selfDeaf: false, selfMute: true });
        await entersState(conn, VoiceConnectionStatus.Ready, 15_000);
        vcSessions.set(newState.guild.id, { conn, channelId: hangoutId, transcript: [], start: Date.now() });
        conn.receiver.speaking.on('start', uid => {
          const s = conn.receiver.subscribe(uid, { end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 } });
          s.on('data', () => {}); s.on('end', () => {});
        });
        const textCh = config.CHANNELS.GENERAL ? newState.guild.channels.cache.get(config.CHANNELS.GENERAL) : null;
        if (textCh) await textCh.send(`Joined **${ch.name}**. I'm listening. Use /leavevc when done.`);
      } catch {}
    }
  }

  // Auto-leave when empty
  if (oldState.channelId && vcSessions.has(oldState.guild.id)) {
    const session = vcSessions.get(oldState.guild.id);
    if (session.channelId === oldState.channelId) {
      const ch = oldState.guild.channels.cache.get(oldState.channelId);
      if (!ch || ch.members.filter(m => !m.user.bot).size === 0) {
        session.conn?.destroy();
        vcSessions.delete(oldState.guild.id);
        const textCh = config.CHANNELS.GENERAL ? oldState.guild.channels.cache.get(config.CHANNELS.GENERAL) : null;
        if (textCh) await textCh.send('Everyone left the VC so I bounced too.').catch(() => {});
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// INTERACTION HANDLER — buttons + slash commands
// ═══════════════════════════════════════════════════════════════

client.on('interactionCreate', async (interaction) => {
  // Verify button
  if (interaction.isButton() && interaction.customId === 'ng_verify') {
    try {
      const role = config.ROLES.VERIFIED ? interaction.guild.roles.cache.get(config.ROLES.VERIFIED) : null;
      if (!role) return interaction.reply({ content: 'Verified role not configured. Ask a staff member.', ephemeral: true });
      if (interaction.member.roles.cache.has(role.id)) return interaction.reply({ content: 'You are already verified.', ephemeral: true });
      await interaction.member.roles.add(role);
      await interaction.reply({ content: `You are verified now. Welcome to the full ${config.COMMUNITY} experience!`, ephemeral: true });
      logModAction(interaction.guild, interaction.user.id, 'verified', `${interaction.user.tag} verified`);
    } catch (err) {
      await interaction.reply({ content: 'Something went wrong. Tag a staff member.', ephemeral: true });
    }
    return;
  }

  // Follow confirm button (from /linkx)
  if (interaction.isButton() && interaction.customId.startsWith('confirm_follow_')) {
    const handle = interaction.customId.replace('confirm_follow_', '');
    try {
      q.upsertMember.run(interaction.user.id, interaction.user.username);
      const db = require('./db').db;
      db.prepare('UPDATE members SET x_handle = ?, x_verified = 1 WHERE discord_id = ?').run(handle, interaction.user.id);
      const check = q.getMember.get(interaction.user.id);
      if (!check?.x_verified) {
        db.prepare('INSERT OR REPLACE INTO members (discord_id, username, x_handle, x_verified) VALUES (?, ?, ?, 1)').run(interaction.user.id, interaction.user.username, handle);
      }
      await interaction.update({
        content: `Linked **@${handle}**. When posts drop${config.CHANNELS.X_TASKS ? ` in <#${config.CHANNELS.X_TASKS}>` : ''}, engage on X then react to claim points.\n👍 Like = 1pt | 💬 Comment = 2pt | 🔄 Retweet = 3pt | ⭐ All three = 6pt`,
        components: [],
      });
    } catch { await interaction.reply({ content: 'Something went wrong. Try /linkx again.', ephemeral: true }).catch(() => {}); }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'points':             await cmdPoints(interaction); break;
      case 'leaderboard':        await cmdLeaderboard(interaction); break;
      case 'invites':            await cmdInvites(interaction); break;
      case 'invitesleaderboard': await cmdInvitesLeaderboard(interaction); break;
      case 'linkx':              await cmdLinkX(interaction); break;
      case 'faq':                await cmdFAQ(interaction); break;
      case 'joinvc':             await cmdJoinVC(interaction); break;
      case 'leavevc':            await cmdLeaveVC(interaction); break;
      case 'vcsummary':          await cmdVCSummary(interaction); break;
      case 'help':               await cmdHelp(interaction); break;
      case 'xcheck':             await cmdXCheck(interaction); break;
      case 'myprofile':          await cmdMyProfile(interaction); break;
      case 'modstats':           await cmdModStats(interaction); break;
      case 'announce':           await cmdAnnounce(interaction); break;
      case 'posttweet':          await cmdPostTweet(interaction); break;
      case 'verifyx':            await cmdVerifyX(interaction); break;
      default: await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (err) {
    console.error(`Cmd error (${interaction.commandName}):`, err.message);
    const r = { content: 'Something went wrong.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(r).catch(() => {});
    else await interaction.reply(r).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════

async function cmdPoints(i) {
  const t = i.options.getUser('user') || i.user;
  q.upsertMember.run(t.id, t.username);
  const m = q.getMember.get(t.id);
  await i.reply({ embeds: [new EmbedBuilder().setColor(config.BOT_COLOR).setTitle('Points')
    .addFields({name:'Member',value:`<@${t.id}>`,inline:true},{name:'Total',value:`${m?.total_points||0}`,inline:true},{name:'X',value:m?.x_verified?`@${m.x_handle}`:'Not linked',inline:true})]});
}

async function cmdLeaderboard(i) {
  const rows = q.getLeaderboard.all(i.options.getInteger('limit')||10);
  if (!rows.length) return i.reply({content:'No points yet.',ephemeral:true});
  const lines = rows.map((r,idx)=>`**${idx+1}.** <@${r.discord_id}> ${r.total_points} pts`);
  await i.reply({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('Leaderboard').setDescription(lines.join('\n'))]});
}

async function cmdInvites(i) {
  const t = i.options.getUser('user') || i.user;
  q.upsertMember.run(t.id, t.username);
  const m = q.getMember.get(t.id);
  await i.reply(`<@${t.id}> has **${m?.invite_count||0}** invite${(m?.invite_count||0)!==1?'s':''}.`);
}

async function cmdInvitesLeaderboard(i) {
  const rows = q.getInviteLeaderboard.all(i.options.getInteger('limit')||10);
  if (!rows.length) return i.reply({content:'No invites tracked yet.',ephemeral:true});
  const lines = rows.map((r,idx)=>`**${idx+1}.** <@${r.discord_id}> ${r.invite_count} invites`);
  await i.reply({embeds:[new EmbedBuilder().setColor(0x57F287).setTitle('Invite Leaderboard').setDescription(lines.join('\n'))]});
}

async function cmdLinkX(i) {
  let handle = i.options.getString('handle').trim();
  if (handle.startsWith('@')) handle = handle.substring(1);
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return i.reply({content:'Invalid handle.',ephemeral:true});
  await i.deferReply({ephemeral:true});
  try {
    const res = await fetch(`https://publish.twitter.com/oembed?url=https://x.com/${handle}&omit_script=true`);
    if (!res.ok) return i.editReply(`The handle **@${handle}** doesn't exist on X. Check the spelling.`);
  } catch { return i.editReply('Could not verify handle right now. Try again.'); }
  q.upsertMember.run(i.user.id, i.user.username);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(`Open @${config.X_ACCOUNT||'X'}`).setStyle(ButtonStyle.Link).setURL(`https://x.com/${config.X_ACCOUNT||'twitter'}`),
    new ButtonBuilder().setCustomId(`confirm_follow_${handle}`).setLabel('I follow').setStyle(ButtonStyle.Success).setEmoji('✅'),
  );
  await i.editReply({content:`Found **@${handle}** on X.\n\nMake sure you${config.X_ACCOUNT?` follow **@${config.X_ACCOUNT}** and then`:''} click confirm.`,components:[row]});
}

async function cmdFAQ(i) {
  const q2 = i.options.getString('question');
  if (!q2) {
    const faqs = getAllFAQ();
    return i.reply({embeds:[new EmbedBuilder().setColor(config.BOT_COLOR).setTitle('FAQ').setDescription(faqs.map(f=>`**${f.index}.** ${f.question}`).join('\n'))]});
  }
  const m = matchFAQ(q2);
  if (m) await i.reply(m.answer);
  else await i.reply('Not sure about that one. Feel free to ask here and someone will help.');
}

async function cmdJoinVC(i) {
  const mv = i.member?.voice;
  if (!mv?.channel) return i.reply({content:'Join a voice channel first.',ephemeral:true});
  try {
    const conn = joinVoiceChannel({channelId:mv.channel.id,guildId:i.guildId,adapterCreator:i.guild.voiceAdapterCreator,selfDeaf:false,selfMute:true});
    await entersState(conn, VoiceConnectionStatus.Ready, 15_000);
    conn.receiver.speaking.on('start', uid => { const s=conn.receiver.subscribe(uid,{end:{behavior:EndBehaviorType.AfterSilence,duration:2000}}); s.on('data',()=>{}); s.on('end',()=>{}); });
    vcSessions.set(i.guildId, {conn, channelId:mv.channel.id, transcript:[], start:Date.now()});
    await i.reply(`Joined **${mv.channel.name}**. I'm listening. Use /leavevc to leave.`);
    logModAction(i.guild, i.user.id, 'vc_join', `Bot joined VC: ${mv.channel.name}`);
  } catch { await i.reply({content:'Could not join. Check permissions.',ephemeral:true}); }
}

async function cmdLeaveVC(i) {
  const session = vcSessions.get(i.guildId);
  if (!session) return i.reply({content:'Not in a voice channel.',ephemeral:true});
  await i.deferReply();
  const duration = Math.round((Date.now()-session.start)/60000);
  session.conn?.destroy();
  vcSessions.delete(i.guildId);
  await i.editReply(`Left after ${duration} minute${duration!==1?'s':''}. Thanks for having me.`);
}

async function cmdVCSummary(i) {
  const session = vcSessions.get(i.guildId);
  if (!session) return i.reply({content:'Not in a VC right now.',ephemeral:true});
  const duration = Math.round((Date.now()-session.start)/60000);
  await i.reply(`Been in the VC for **${duration} minutes** so far.`);
}

async function cmdHelp(i) {
  const embed = new EmbedBuilder().setColor(config.BOT_COLOR).setTitle(`${config.BOT_NAME} Bot`).addFields(
    {name:'Engagement',value:'`/points` `/leaderboard` `/linkx` `/xcheck`',inline:false},
    {name:'Invites',value:'`/invites` `/invitesleaderboard`',inline:false},
    {name:'Info',value:'`/faq` `/myprofile` `/help`',inline:false},
    {name:'Voice',value:'`/joinvc` `/leavevc` `/vcsummary`',inline:false},
    {name:'Staff',value:'`/announce` `/posttweet` `/modstats` `/verifyx`',inline:false},
    {name:'Points',value:`Link X with /linkx${config.X_ACCOUNT?`, follow @${config.X_ACCOUNT},`:','} then react on task posts. Like=1 Comment=2 RT=3 All=6`,inline:false},
  );
  await i.reply({embeds:[embed]});
}

async function cmdXCheck(i) {
  const t = i.options.getUser('user')||i.user;
  const m = q.getMember.get(t.id);
  if (!m?.x_verified) return i.reply({content:'X not linked. Use /linkx.',ephemeral:true});
  const db = require('./db').db;
  const bd = db.prepare('SELECT action_type,COUNT(*) as cnt,SUM(points) as pts FROM x_engagements WHERE discord_id=? GROUP BY action_type').all(t.id);
  const like=bd.find(b=>b.action_type==='like')||{cnt:0,pts:0};
  const rt=bd.find(b=>b.action_type==='retweet')||{cnt:0,pts:0};
  const cm=bd.find(b=>b.action_type==='comment')||{cnt:0,pts:0};
  await i.reply({embeds:[new EmbedBuilder().setColor(0x1DA1F2).setTitle(`X @${m.x_handle}`).addFields(
    {name:'Likes',value:`${like.cnt} (${like.pts}pts)`,inline:true},
    {name:'Comments',value:`${cm.cnt} (${cm.pts}pts)`,inline:true},
    {name:'Retweets',value:`${rt.cnt} (${rt.pts}pts)`,inline:true},
    {name:'Total',value:`**${m.total_points}**`,inline:false},
  )]});
}

async function cmdMyProfile(i) {
  q.upsertMember.run(i.user.id, i.user.username);
  const d = q.getMember.get(i.user.id);
  const s = q.getStreak.get(i.user.id, 'gm');
  await i.reply({embeds:[new EmbedBuilder().setColor(config.BOT_COLOR).setTitle(i.user.displayName).setThumbnail(i.user.displayAvatarURL({size:256})).addFields(
    {name:'Points',value:`${d?.total_points||0}`,inline:true},
    {name:'Invites',value:`${d?.invite_count||0}`,inline:true},
    {name:'GM Streak',value:`${s?.streak_count||0} days`,inline:true},
    {name:'X',value:d?.x_verified?`@${d.x_handle}`:'Not linked',inline:true},
  )]});
}

async function cmdModStats(i) {
  if (!isAdmin(i.member)) return i.reply({content:'Staff only.',ephemeral:true});
  const actions = q.getModActions.all(i.options.getInteger('limit')||10);
  if (!actions.length) return i.reply({content:'No actions yet.',ephemeral:true});
  const lines = actions.map(a=>`<t:${Math.floor(new Date(a.created_at).getTime()/1000)}:R> **${a.action_type}** ${a.discord_id?`<@${a.discord_id}>`:'System'}\n${a.reason}`);
  await i.reply({embeds:[new EmbedBuilder().setColor(0xED4245).setTitle('Mod Log').setDescription(lines.join('\n\n')).setFooter({text:`Last ${actions.length}`})],ephemeral:true});
}

async function cmdAnnounce(i) {
  if (!isAdmin(i.member)) return i.reply({content:'Staff only.',ephemeral:true});
  const title=i.options.getString('title'), body=i.options.getString('body');
  const ch=i.options.getChannel('channel')||i.guild.channels.cache.get(config.CHANNELS.ANNOUNCEMENTS)||i.channel;
  const color=i.options.getString('color')||'#5865F2';
  const embed=new EmbedBuilder().setColor(parseInt(color.replace('#',''),16)).setTitle(title).setDescription(body).setTimestamp();
  if (i.options.getString('image')) embed.setImage(i.options.getString('image'));
  embed.setFooter({text:i.options.getString('footer')||i.user.displayName});
  try {
    await ch.send({content:i.options.getBoolean('ping_everyone')?'@everyone':undefined,embeds:[embed],allowedMentions:i.options.getBoolean('ping_everyone')?{parse:['everyone']}:{}});
    await i.reply({content:`Sent to <#${ch.id}>.`,ephemeral:true});
    logModAction(i.guild,i.user.id,'announcement',`"${title}" in #${ch.name}`);
  } catch { await i.reply({content:'Could not send. Check permissions.',ephemeral:true}); }
}

async function cmdPostTweet(i) {
  if (!isAdmin(i.member)) return i.reply({content:'Staff only.',ephemeral:true});
  const url=i.options.getString('url').trim();
  const match=url.match(/https?:\/\/(?:x\.com|twitter\.com)\/(\w+)\/status\/(\d+)/i);
  if (!match) return i.reply({content:'Invalid tweet URL.',ephemeral:true});
  await i.deferReply({ephemeral:true});
  const [,tweetUser,tweetId]=match;
  const db=require('./db').db;
  if (db.prepare('SELECT 1 FROM x_tweets WHERE tweet_id=?').get(tweetId)) return i.editReply('Already tracking that tweet.');
  let tweetText='';
  try {
    const r=await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`);
    if (r.ok) { const d=await r.json(); tweetText=(d.html||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim(); if (tweetText.length>300) tweetText=tweetText.substring(0,297)+'...'; }
  } catch {}
  const taskCh=i.guild.channels.cache.get(config.CHANNELS.X_TASKS);
  if (!taskCh) return i.editReply('X Tasks channel not configured.');
  const customMsg=i.options.getString('message');
  const post=await taskCh.send({
    content:(customMsg?`${customMsg}\n\n`:`**New post from @${tweetUser}!** @everyone\n\n`)+
      `Engage on X then react below to claim points.\n\n`+
      (tweetText?`> ${tweetText.split('\n').join('\n> ')}\n\n`:'')+
      `👍 Like = 1pt | 💬 Comment = 2pt | 🔄 Retweet = 3pt | ⭐ All three = 6pt\n\n${url}`,
    allowedMentions:{parse:['everyone']},
  });
  await post.react('👍'); await post.react('💬'); await post.react('🔄'); await post.react('⭐');
  db.prepare('INSERT OR IGNORE INTO x_tweets (tweet_id,tweet_url,tweet_text,message_id) VALUES (?,?,?,?)').run(tweetId,url,tweetText||'',post.id);
  await i.editReply(`Posted in <#${taskCh.id}>.`);
  logModAction(i.guild,i.user.id,'tweet_post',`@${tweetUser}/status/${tweetId}`);
}

async function cmdVerifyX(i) {
  if (!isAdmin(i.member)) return i.reply({content:'Staff only.',ephemeral:true});
  const t=i.options.getUser('user');
  const m=q.getMember.get(t.id);
  if (!m?.x_verified) return i.reply({content:`<@${t.id}> hasn't linked X.`,ephemeral:true});
  if (i.options.getBoolean('revoke')) {
    const db=require('./db').db;
    db.prepare('UPDATE members SET x_handle=NULL,x_verified=0,total_points=0 WHERE discord_id=?').run(t.id);
    db.prepare('DELETE FROM x_engagements WHERE discord_id=?').run(t.id);
    db.prepare('DELETE FROM points_ledger WHERE discord_id=?').run(t.id);
    return i.reply({content:`Revoked @${m.x_handle} from <@${t.id}> and reset their points.`,ephemeral:true});
  }
  await i.reply({content:`<@${t.id}> is linked as **@${m.x_handle}** ([view](https://x.com/${m.x_handle})). **${m.total_points}** pts.\n\nUse \`revoke:True\` to remove.`,ephemeral:true});
}

// ═══════════════════════════════════════════════════════════════
// MOD LOG
// ═══════════════════════════════════════════════════════════════

async function logModAction(guild, discordId, type, reason, channelId = null) {
  q.logModAction.run(discordId, type, reason, channelId);
  try {
    const ch = guild.channels.cache.get(config.CHANNELS.MOD_REPORT || config.CHANNELS.LOG);
    if (ch) await ch.send(`**${type.replace(/_/g,' ')}** ${discordId?`<@${discordId}>`:'System'}\n${reason}\n<t:${Math.floor(Date.now()/1000)}:f>`);
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULED TASKS
// ═══════════════════════════════════════════════════════════════

function startScheduledTasks() {
  const getGuild  = () => client.guilds.cache.get(config.GUILD_ID);
  const getCh     = id => id ? getGuild()?.channels.cache.get(id) : null;

  // Staff reminder
  if (config.CRONS.STAFF_REMINDER) {
    cron.schedule(config.CRONS.STAFF_REMINDER, async () => {
      const ch = getCh(config.CHANNELS.STAFF_CHAT); if (!ch) return;
      const day=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getUTCDay()];
      await ch.send({content:`Morning team.${config.ROLES.ADMIN?` <@&${config.ROLES.ADMIN}>`:''}${' '}${day} checklist:\n\nCheck support tickets, review mod log, engage with community, verify pending members, post on X if needed.`,allowedMentions:{roles:config.ROLES.ADMIN?[config.ROLES.ADMIN]:[]}});
    });
  }

  // Contributor motivation
  if (config.CRONS.CONTRIBUTOR_MOTIVATE && config.CHANNELS.CONTRIBUTOR_CHAT) {
    cron.schedule(config.CRONS.CONTRIBUTOR_MOTIVATE, async () => {
      const ch = getCh(config.CHANNELS.CONTRIBUTOR_CHAT); if (!ch) return;
      const msgs = [
        `Morning${config.ROLES.CONTRIBUTOR?` <@&${config.ROLES.CONTRIBUTOR}>`:' team'}. What are you working on today?`,
        `New day${config.ROLES.CONTRIBUTOR?` <@&${config.ROLES.CONTRIBUTOR}>`:''}, new progress. What's the focus?`,
        `Checking in${config.ROLES.CONTRIBUTOR?` <@&${config.ROLES.CONTRIBUTOR}>`:''}, the builders make this real. What are you tackling?`,
        `${config.ROLES.CONTRIBUTOR?`<@&${config.ROLES.CONTRIBUTOR}> c`:'C'}onsistency wins. What's today's plan?`,
      ];
      await ch.send({content:pick(msgs),allowedMentions:{roles:config.ROLES.CONTRIBUTOR?[config.ROLES.CONTRIBUTOR]:[]}});
    });
  }

  // Contributor report summary
  if (config.CRONS.CONTRIBUTOR_SUMMARY && config.CHANNELS.CONTRIBUTOR_RPT && config.CHANNELS.STAFF_CHAT) {
    cron.schedule(config.CRONS.CONTRIBUTOR_SUMMARY, async () => {
      try {
        const rptCh = getCh(config.CHANNELS.CONTRIBUTOR_RPT);
        const staffCh = getCh(config.CHANNELS.STAFF_CHAT);
        if (!rptCh || !staffCh) return;
        const msgs = await rptCh.messages.fetch({limit:50});
        const cutoff = Date.now() - 24*60*60*1000;
        const recent = msgs.filter(m => m.createdTimestamp > cutoff && !m.author.bot);
        if (recent.size === 0) { await staffCh.send(`${config.ROLES.ADMIN?`<@&${config.ROLES.ADMIN}> `:''}No contributor reports in the last 24 hours.`); return; }
        const text = recent.map(m=>`${m.author.displayName}: ${m.content}`).reverse().join('\n');
        const summary = await ai.summarizeText(text);
        await staffCh.send({content:`${config.ROLES.ADMIN?`<@&${config.ROLES.ADMIN}> `:''}**Contributor Summary** (${recent.size} reports):\n\n${summary||text.substring(0,500)}`,allowedMentions:{roles:config.ROLES.ADMIN?[config.ROLES.ADMIN]:[]}});
      } catch {}
    });
  }

  // General engagement
  if (config.CRONS.GENERAL_ENGAGE && config.CHANNELS.GENERAL) {
    cron.schedule(config.CRONS.GENERAL_ENGAGE, async () => {
      const ch = getCh(config.CHANNELS.GENERAL); if (!ch) return;
      const msgs = [
        'Anyone working on something interesting lately? Always curious what people in this community are building.',
        'Digital sovereignty is a topic more people should care about. Most people have no idea how much data gets harvested from them daily.',
        `Want to earn engagement points? Link your X with /linkx${config.X_ACCOUNT?` and follow @${config.X_ACCOUNT}`:''}. Points go to the most active members.`,
        'The gap between people who understand web3 and those who don\'t is widening fast. Good thing you\'re already here.',
        'Use /leaderboard to see where you stand. If you\'ve been engaging, check your points too.',
      ];
      const idx = Math.floor(Date.now()/(4*3600*1000)) % msgs.length;
      await ch.send(msgs[idx]);
    });
  }

  // AI convo starter
  if (config.CRONS.CONVO_STARTER && config.CHANNELS.GENERAL) {
    cron.schedule(config.CRONS.CONVO_STARTER, async () => {
      const ch = getCh(config.CHANNELS.GENERAL); if (!ch) return;
      const starter = await ai.generateConvoStarter();
      if (starter) { await ch.send(starter); ai.addToBuffer(config.CHANNELS.GENERAL, config.BOT_NAME, starter, true); }
    });
  }

  // Announcement watcher
  if (config.CHANNELS.ANNOUNCEMENTS && config.CHANNELS.GENERAL) {
    setTimeout(() => {
      const ch = getCh(config.CHANNELS.ANNOUNCEMENTS); if (!ch) return;
      const collector = ch.createMessageCollector({ filter: m => !m.author.bot });
      collector.on('collect', async () => {
        const gen = getCh(config.CHANNELS.GENERAL);
        if (gen && !isOnCooldown('ann-notify', 300)) await gen.send('New announcement just went up, check it out.');
      });
    }, 5000);
  }

  console.log('[Scheduler] Tasks started');
}

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK (for Railway)
// ═══════════════════════════════════════════════════════════════

const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('OK'); })
  .listen(process.env.PORT || 3000, () => console.log(`  Health check on port ${process.env.PORT || 3000}`));

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════

if (!process.env.DISCORD_TOKEN) { console.error('Missing DISCORD_TOKEN'); process.exit(1); }
client.login(process.env.DISCORD_TOKEN).catch(err => { console.error('Login failed:', err.message); process.exit(1); });
process.on('SIGINT', () => { client.destroy(); process.exit(0); });
process.on('unhandledRejection', err => console.error('Unhandled:', err?.message));
