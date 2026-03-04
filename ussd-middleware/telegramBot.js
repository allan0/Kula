const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf('YOUR_TELEGRAM_BOT_TOKEN');

bot.start((ctx) => {
  const referralId = ctx.startPayload; // Captures t.me/KulaBot?start=123
  
  ctx.replyWithMarkdownV2(
    `*Welcome to the KULA Vault, ${ctx.from.first_name}* \n\n` +
    `Your reputation score is being initialized on Base L2\\.\n` +
    `Current Integrity Status: *Neutral \\(50/100\\)*`,
    Markup.keyboard([
      ['💎 Join Exclusive Circle', '🎨 Create New Circle'],
      ['📈 My Reputation Score', '🤝 Referral Program']
    ]).resize()
  );
});

bot.hears('💎 Join Exclusive Circle', (ctx) => {
  ctx.reply('Select an elite circle to view their goals and Telegram channel:', 
    Markup.inlineKeyboard([
      [Markup.button.url('Nairobi High Circle (Real Estate)', 'https://t.me/KulaNairobi')],
      [Markup.button.url('Base Builders (Vehicles)', 'https://t.me/KulaBuilders')],
      [Markup.button.callback('Apply to Join Group #01', 'apply_1')]
    ])
  );
});

bot.action('apply_1', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("Application Submitted! The group members are now auditing your reputation score. You will be notified once the vote is complete.");
});

bot.launch();
