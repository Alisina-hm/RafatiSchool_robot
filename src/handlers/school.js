const { Markup } = require("telegraf");
const crypto = require("crypto");

const {
  saveGroup,
  saveRegistration,
  getRegistration,
  deleteRegistration,
} = require("../database/db");

const BACK_BUTTON = "🏠 بازگشت به صفحه اصلی";
const GUIDE_BUTTON = "📖 راهنمای ایجاد مدرسه";
const START_BUTTON = "🚀 شروع مراحل ثبت مدرسه";
const GROUP_ID_BUTTON = "🔙 بازگشت به مراحل ثبت";

const mainMenu = Markup.keyboard([["🏫 ایجاد مدرسه"], ["🔑 ورود به مدرسه"]])
  .resize()
  .persistent();

const schoolMenu = Markup.keyboard([
  ["🚀 شروع مراحل ثبت مدرسه"],
  ["📖 راهنمای ایجاد مدرسه"],
  [BACK_BUTTON],
]).resize();

const guideMenu = Markup.keyboard([[GROUP_ID_BUTTON], [BACK_BUTTON]]).resize();

const backKeyboard = Markup.keyboard([[BACK_BUTTON]]).resize();

// نمایش راهنمای ایجاد مدرسه
const showGuide = (ctx) => {
  return ctx.reply(
    "📖 راهنمای ایجاد مدرسه\n\n" +
      "برای ایجاد مدرسه، مراحل زیر را به ترتیب انجام دهید:\n\n" +
      "1️⃣ افزودن ربات به گروه\n" +
      "ابتدا ربات را به گروه تلگرام خود اضافه کنید.\n\n" +
      "2️⃣ مدیر کردن ربات\n" +
      "پس از اضافه کردن ربات، آن را به مدیر گروه تبدیل کنید تا بتواند اطلاعات گروه و مالک آن را بررسی کند.\n\n" +
      "3️⃣ ارسال شناسه گروه\n" +
      "شناسه عددی گروه را در گفت‌وگوی خصوصی ربات ارسال کنید.\n\n" +
      "4️⃣ تأیید مالکیت\n" +
      "ربات در گروه یک پیام تأیید ارسال می‌کند. مالک اصلی گروه باید دکمه تأیید را بزند.\n\n" +
      "5️⃣ تعیین رمز عبور\n" +
      "پس از تأیید مالکیت، در گفت‌وگوی خصوصی یک رمز عبور برای مدرسه انتخاب کنید.\n\n" +
      "6️⃣ انتخاب نام کاربری\n" +
      "یک نام کاربری اختصاصی برای مدرسه انتخاب کنید. نام کاربری نباید قبلاً ثبت شده باشد.\n\n" +
      "7️⃣ پایان ثبت‌نام\n" +
      "پس از تکمیل مراحل، مدرسه شما ثبت می‌شود و می‌توانید از نام کاربری و رمز عبور آن برای ورود استفاده کنید.\n\n" +
      "⚠️ نکات مهم:\n" +
      "• فقط مالک اصلی گروه می‌تواند مدرسه را ثبت کند.\n" +
      "• ربات باید در گروه مدیر باشد.\n" +
      "• رمز عبور خود را در اختیار دیگران قرار ندهید.",
    guideMenu,
  );
};

const schoolHandler = (bot) => {
  // نمایش منوی ایجاد مدرسه
  bot.hears("🏫 ایجاد مدرسه", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    await ctx.reply(
      "🏫 بخش ایجاد مدرسه\n\n" +
        "برای شروع ثبت مدرسه، گزینه شروع مراحل ثبت مدرسه را انتخاب کنید.\n" +
        "اگر با مراحل آشنایی ندارید، ابتدا راهنما را مطالعه کنید.",
      schoolMenu,
    );
  });

  // نمایش راهنما
  bot.hears(GUIDE_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    await showGuide(ctx);
  });

  // بازگشت از راهنما به منوی ایجاد مدرسه
  bot.hears(GROUP_ID_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    await ctx.reply(
      "🏫 برای ادامه، شروع مراحل ثبت مدرسه را انتخاب کنید.",
      schoolMenu,
    );
  });

  // شروع ثبت مدرسه
  bot.hears(START_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    saveRegistration(ctx.from.id, null, "waiting_group_id");

    await ctx.reply(
      "🏫 شروع ثبت مدرسه\n\n" +
        "ابتدا ربات را به گروه تلگرام خود اضافه و مدیر کنید.\n\n" +
        "سپس شناسه عددی گروه را همین‌جا ارسال کنید.",
      backKeyboard,
    );
  });

  // بازگشت به صفحه اصلی و لغو ثبت‌نام
  bot.hears(BACK_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    await ctx.reply("به صفحه اصلی برگشتید. 🎓", mainMenu);
  });

  // دریافت شناسه گروه
  bot.on("text", async (ctx, next) => {
    if (ctx.chat.type !== "private") return next();

    const registration = getRegistration(ctx.from.id);

    if (!registration || registration.step !== "waiting_group_id") {
      return next();
    }

    const groupIdText = ctx.message.text.trim();
    const groupId = Number(groupIdText);

    if (
      !/^-?\d+$/.test(groupIdText) ||
      !Number.isSafeInteger(groupId) ||
      groupId >= 0
    ) {
      return ctx.reply(
        "❌ شناسه گروه معتبر نیست.\nلطفاً شناسه عددی گروه را ارسال کنید.",
        backKeyboard,
      );
    }

    try {
      // دریافت اطلاعات ربات
      const botInfo = await ctx.telegram.getMe();

      // بررسی مدیر بودن ربات
      const botMember = await ctx.telegram.getChatMember(groupId, botInfo.id);

      if (
        botMember.status !== "administrator" &&
        botMember.status !== "creator"
      ) {
        return ctx.reply(
          "❌ ربات در گروه مدیر نیست.\n" +
            "ابتدا ربات را به گروه اضافه و مدیر کنید.",
          backKeyboard,
        );
      }

      // دریافت اطلاعات گروه
      const chat = await ctx.telegram.getChat(groupId);

      if (chat.type !== "group" && chat.type !== "supergroup") {
        return ctx.reply(
          "❌ شناسه واردشده مربوط به گروه معتبر نیست.",
          backKeyboard,
        );
      }

      // بررسی مالک واقعی گروه
      const owner = await ctx.telegram.getChatMember(groupId, ctx.from.id);

      if (owner.status !== "creator") {
        return ctx.reply(
          "❌ فقط مالک اصلی گروه می‌تواند مدرسه ایجاد کند.\n\n" +
            "با حساب تلگرامی مالک گروه وارد ربات شوید.",
          backKeyboard,
        );
      }

      // ذخیره اطلاعات گروه
      saveGroup(chat.id, chat.title || "بدون نام", chat.username || null);

      // ساخت شناسه امن درخواست تأیید
      const approvalToken = crypto.randomBytes(8).toString("hex");

      saveRegistration(ctx.from.id, chat.id, "awaiting_owner_approval", {
        approvalToken,
        groupTitle: chat.title || "بدون نام",
      });

      // ارسال درخواست تأیید به گروه
      await ctx.telegram.sendMessage(
        chat.id,
        "🏫 درخواست ایجاد مدرسه برای این گروه ثبت شده است.\n\n" +
          "مالک گروه، برای تأیید درخواست روی دکمه زیر بزنید:",
        Markup.inlineKeyboard([
          Markup.button.callback(
            "✅ تأیید مالکیت و ادامه",
            `school:approve:${approvalToken}`,
          ),
        ]),
      );

      await ctx.reply(
        "✅ ربات گروه را شناسایی کرد.\n\n" +
          "درخواست تأیید مالکیت به گروه ارسال شد.\n" +
          "پس از تأیید در گروه، مراحل بعدی را انجام دهید.",
        backKeyboard,
      );
    } catch (error) {
      console.error("School group verification error:", error);

      await ctx.reply(
        "❌ بررسی گروه با خطا مواجه شد.\n\n" +
          "مطمئن شوید شناسه گروه درست است و ربات در گروه مدیر است.",
        backKeyboard,
      );
    }
  });

  // دریافت تأیید مالک در گروه
  bot.action(/^school:approve:([a-f0-9]{16})$/, async (ctx) => {
    const token = ctx.match[1];

    try {
      const registration = getRegistration(ctx.from.id);

      if (
        !registration ||
        registration.step !== "awaiting_owner_approval" ||
        registration.data.approvalToken !== token ||
        registration.group_id !== ctx.chat.id
      ) {
        return ctx.answerCbQuery("این درخواست معتبر نیست یا منقضی شده است.", {
          show_alert: true,
        });
      }

      // بررسی مالک واقعی گروه
      const owner = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);

      if (owner.status !== "creator") {
        return ctx.answerCbQuery("فقط مالک اصلی گروه اجازه تأیید دارد.", {
          show_alert: true,
        });
      }

      await ctx.answerCbQuery("مالکیت تأیید شد.");

      // انتقال ثبت‌نام به مرحله رمز عبور
      saveRegistration(ctx.from.id, registration.group_id, "waiting_password", {
        ...registration.data,
        ownerId: ctx.from.id,
        ownerName: ctx.from.first_name || ctx.from.username || "مالک گروه",
      });

      await ctx.editMessageText(
        "✅ مالکیت گروه تأیید شد.\n\n" +
          "ادامه فرایند ایجاد مدرسه باید توسط مالک در گفت‌وگوی خصوصی ربات انجام شود.",
      );

      await ctx.telegram.sendMessage(
        ctx.from.id,
        "🔐 مالکیت گروه تأیید شد.\n\n" +
          "حالا یک رمز عبور برای مدرسه انتخاب کنید و آن را ارسال کنید.",
        backKeyboard,
      );
    } catch (error) {
      console.error("School approval error:", error);

      await ctx.answerCbQuery("هنگام تأیید خطایی رخ داد.", {
        show_alert: true,
      });
    }
  });
};

module.exports = schoolHandler;
