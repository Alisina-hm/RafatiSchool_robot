const { Markup } = require("telegraf");

const startHandler = (bot) => {
  bot.start((ctx) => {
    ctx.reply(
      "سلام! به ربات مدرسه خوش آمدید 🎓\n\nبرای ادامه یکی از گزینه‌های زیر را انتخاب کنید:",
      Markup.keyboard([["🏫 ایجاد مدرسه"], ["🔑 ورود به مدرسه"]])
        .resize()
        .persistent(),
    );
  });
};

module.exports = startHandler;
