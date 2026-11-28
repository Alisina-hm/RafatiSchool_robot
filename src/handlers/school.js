const { Markup } = require("telegraf");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jalaali = require("jalaali-js");

const {
  saveGroup,
  saveRegistration,
  getRegistration,
  deleteRegistration,
  isSchoolUsernameTaken,
  createSchool,
  getSchoolByUsername,
  updateSchoolPassword,
  saveSchoolSession,
  getSchoolSession,
  deleteSchoolSession,
  createManager,
  getManagerByUsername,
  getManagerByUserId,
  isManagerUsernameTaken,
  getSchoolUsernameById,
  getSchoolByGroupId,
  getAllSchoolAdmins,
  getSchoolById,
  getManagersBySchoolId,
  createHomework,
  getUpcomingHomeworks,
  createExam,
  getUpcomingExams,
} = require("../database/db");

// دکمه‌ها
const BACK_BUTTON = "🏠 بازگشت به صفحه اصلی";
const GUIDE_BUTTON = "📖 راهنمای ایجاد مدرسه";
const START_BUTTON = "🚀 شروع مراحل ثبت مدرسه";
const GROUP_ID_BUTTON = "🔙 بازگشت به مراحل ثبت";
const LOGIN_BUTTON = "🔑 ورود به مدرسه";
const FORGOT_PASSWORD_BUTTON = "🔒 فراموشی رمز عبور";
const LOGOUT_BUTTON = "🚪 خروج از حساب";

const OWNER_LOGIN_BUTTON = "👑 مالک مدرسه هستم";
const MANAGER_LOGIN_BUTTON = "👨‍💼 مدیر مدرسه هستم";
const MANAGER_CREATE_BUTTON = "🆕 ساخت حساب مدیر";
const MANAGER_HAS_ACCOUNT_BUTTON = "🔑 از قبل حساب دارم";

// منوی اصلی
const mainMenu = Markup.keyboard([["🏫 ایجاد مدرسه"], [LOGIN_BUTTON]])
  .resize()
  .persistent();

// منوی ایجاد مدرسه
const schoolMenu = Markup.keyboard([
  [START_BUTTON],
  [GUIDE_BUTTON],
  [BACK_BUTTON],
]).resize();

const guideMenu = Markup.keyboard([[GROUP_ID_BUTTON], [BACK_BUTTON]]).resize();

const backKeyboard = Markup.keyboard([[BACK_BUTTON]]).resize();

// انتخاب نوع ورود
const loginRoleMenu = Markup.keyboard([
  [OWNER_LOGIN_BUTTON],
  [MANAGER_LOGIN_BUTTON],
  [FORGOT_PASSWORD_BUTTON],
  [BACK_BUTTON],
]).resize();

// منوی ورود
const loginMenu = Markup.keyboard([
  [FORGOT_PASSWORD_BUTTON],
  [BACK_BUTTON],
]).resize();

// انتخاب ساخت حساب یا ورود مدیر
const managerLoginMenu = Markup.keyboard([
  [MANAGER_CREATE_BUTTON],
  [MANAGER_HAS_ACCOUNT_BUTTON],
  [BACK_BUTTON],
]).resize();

// پنل مالک مدرسه
const ownerDashboardMenu = Markup.keyboard([
  ["👥 ادمین‌ها"],
  ["📝 امتحان‌ها", "📚 تکالیف"],
  [LOGOUT_BUTTON],
  [BACK_BUTTON],
])
  .resize()
  .persistent();

// پنل مدیر مدرسه
const managerDashboardMenu = Markup.keyboard([
  ["📝 امتحان‌ها", "📚 تکالیف"],
  [LOGOUT_BUTTON],
  [BACK_BUTTON],
])
  .resize()
  .persistent();

// نمایش راهنما
const showGuide = (ctx) => {
  return ctx.reply(
    "📖 راهنمای ایجاد مدرسه\n\n" +
      "1️⃣ ربات را به گروه اضافه کنید.\n\n" +
      "2️⃣ ربات را مدیر گروه کنید.\n\n" +
      "3️⃣ شناسه عددی گروه را برای ربات بفرستید.\n\n" +
      "4️⃣ مالک اصلی گروه باید درخواست ایجاد مدرسه را تأیید کند.\n\n" +
      "5️⃣ یک رمز عبور برای مدرسه انتخاب کنید.\n\n" +
      "6️⃣ یک نام کاربری اختصاصی برای مدرسه انتخاب کنید.\n\n" +
      "⚠️ فقط مالک اصلی گروه می‌تواند مدرسه را ثبت کند.",
    guideMenu,
  );
};

const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"];

const weekdayKeyboard = (type) =>
  Markup.inlineKeyboard(
    weekdays.map((day, index) => [
      Markup.button.callback(day, `school:${type}:${index}`),
    ]),
  );

// تبدیل اعداد فارسی و عربی به انگلیسی
function normalizeDigits(value) {
  return value
    .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
}

// تبدیل تاریخ شمسی به میلادی و بررسی صحت آن
function parseJalaliDate(value) {
  const normalized = normalizeDigits(value.trim());
  const match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!jalaali.isValidJalaaliDate(year, month, day)) {
    return null;
  }

  const gregorian = jalaali.toGregorian(year, month, day);

  const isoDate = [
    gregorian.gy,
    String(gregorian.gm).padStart(2, "0"),
    String(gregorian.gd).padStart(2, "0"),
  ].join("-");

  return {
    iso: isoDate,
    jalali: `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`,
    weekdayIndex: new Date(
      Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd),
    ).getUTCDay(),
  };
}

// تاریخ امروز به فرمت میلادی برای مقایسه دیتابیس
function getTodayISO() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

// تبدیل تاریخ میلادی ذخیره‌شده به شمسی
function formatJalaliDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const result = jalaali.toJalaali(year, month, day);

  return `${result.jy}/${String(result.jm).padStart(2, "0")}/${String(result.jd).padStart(2, "0")}`;
}

// پیدا کردن نام ثبت‌کننده
function getCreatorName(ctx) {
  return (
    [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") ||
    ctx.from.username ||
    "کاربر"
  );
}

const schoolHandler = (bot) => {
  // نمایش منوی ایجاد مدرسه
  bot.hears("🏫 ایجاد مدرسه", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    await ctx.reply(
      "🏫 بخش ایجاد مدرسه\n\n" +
        "برای شروع ثبت مدرسه، گزینه شروع مراحل ثبت مدرسه را انتخاب کنید.",
      schoolMenu,
    );
  });

  // شروع ورود
  bot.hears(LOGIN_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    saveRegistration(ctx.from.id, null, "waiting_login_role");

    await ctx.reply(
      "🔑 ورود به مدرسه\n\n" + "لطفاً نوع حساب خود را انتخاب کنید:",
      loginRoleMenu,
    );
  });

  // انتخاب ورود مالک
  bot.hears(OWNER_LOGIN_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    saveRegistration(ctx.from.id, null, "waiting_owner_username");

    await ctx.reply(
      "👑 ورود مالک مدرسه\n\n" + "نام کاربری مدرسه را وارد کنید:",
      loginMenu,
    );
  });

  // انتخاب ورود مدیر
  bot.hears(MANAGER_LOGIN_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    saveRegistration(ctx.from.id, null, "waiting_manager_choice");

    await ctx.reply(
      "👨‍💼 بخش مدیریت مدرسه\n\n" + "لطفاً مشخص کنید:",
      managerLoginMenu,
    );
  });

  // انتخاب ساخت حساب مدیر
  bot.hears(MANAGER_CREATE_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const existingManager = getManagerByUserId(ctx.from.id);

    if (existingManager) {
      return ctx.reply(
        "❌ شما قبلاً حساب مدیر ساخته‌اید.\n" +
          "برای ورود، گزینه «از قبل حساب دارم» را انتخاب کنید.",
        managerLoginMenu,
      );
    }

    deleteRegistration(ctx.from.id);
    saveRegistration(ctx.from.id, null, "waiting_manager_school_username");

    await ctx.reply(
      "🆕 ساخت حساب مدیر\n\n" + "ابتدا نام کاربری مدرسه را وارد کنید:",
      loginMenu,
    );
  });

  // ورود با حساب قبلی
  bot.hears(MANAGER_HAS_ACCOUNT_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const existingManager = getManagerByUserId(ctx.from.id);

    if (!existingManager) {
      return ctx.reply(
        "❌ هنوز حساب مدیری برای شما ثبت نشده است.\n" +
          "ابتدا باید یک حساب جدید بسازید.",
        managerLoginMenu,
      );
    }

    saveRegistration(ctx.from.id, null, "waiting_manager_username");

    await ctx.reply(
      "🔑 ورود به حساب مدیر\n\n" + "نام کاربری اختصاصی خود را وارد کنید:",
      loginMenu,
    );
  });

  // شروع فراموشی رمز عبور
  bot.hears(FORGOT_PASSWORD_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    saveRegistration(ctx.from.id, null, "waiting_forgot_username");

    await ctx.reply(
      "🔒 بازیابی رمز عبور\n\n" + "نام کاربری مدرسه را وارد کنید:",
      loginMenu,
    );
  });

  // خروج از حساب
  bot.hears(LOGOUT_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const session = getSchoolSession(ctx.from.id);

    if (!session) {
      return ctx.reply("شما وارد هیچ حساب مدرسه‌ای نشده‌اید.", mainMenu);
    }

    deleteSchoolSession(ctx.from.id);
    deleteRegistration(ctx.from.id);

    await ctx.reply("🚪 با موفقیت از حساب خارج شدید.", mainMenu);
  });

  // نمایش راهنما
  bot.hears(GUIDE_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;
    await showGuide(ctx);
  });

  // بازگشت از راهنما
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
        "ابتدا ربات را به گروه اضافه و مدیر کنید.\n\n" +
        "سپس شناسه عددی گروه را ارسال کنید.",
      backKeyboard,
    );
  });

  // پیام شناسه گروه پس از مدیر شدن ربات
  bot.on("my_chat_member", async (ctx) => {
    try {
      const chat = ctx.chat;
      const newStatus = ctx.myChatMember.new_chat_member.status;

      if (!["group", "supergroup"].includes(chat.type)) return;
      if (newStatus !== "administrator") return;

      await ctx.telegram.sendMessage(
        chat.id,
        `✅ ربات با موفقیت مدیر گروه شد!

🆔 شناسه عددی گروه:

${chat.id}

این شناسه را در گفت‌وگوی خصوصی ربات ارسال کنید.`,
      );
    } catch (error) {
      console.error("Group ID message error:", error);
    }
  });

  // بازگشت به صفحه اصلی
  bot.hears(BACK_BUTTON, async (ctx) => {
    if (ctx.chat.type !== "private") return;

    deleteRegistration(ctx.from.id);

    await ctx.reply("🏠 به صفحه اصلی ربات بازگشتید.", mainMenu);
  });

  // -----------------------------
  // پرسش از هوش مصنوعی Gemini
  // -----------------------------
  bot.hears(/^\/AskGemini(?:@\w+)?(?:\s+([\s\S]+))?$/i, async (ctx) => {
    if (!["group", "supergroup"].includes(ctx.chat.type)) {
      return ctx.reply("⚠️ این دستور فقط در گروه‌های مدرسه قابل استفاده است.");
    }

    const question = ctx.match[1]?.trim();

    if (!question) {
      return ctx.reply(
        "📝 لطفاً سؤال خود را بعد از دستور بنویسید.\n\n" +
          "مثال:\n/AskGemini چرا آسمان آبی است؟",
        { reply_to_message_id: ctx.message.message_id },
      );
    }

    if (question.length > 2000) {
      return ctx.reply("❌ متن سؤال بیش از حد طولانی است.", {
        reply_to_message_id: ctx.message.message_id,
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return ctx.reply("❌ کلید اتصال به Gemini تنظیم نشده است.", {
        reply_to_message_id: ctx.message.message_id,
      });
    }

    try {
      await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

      const { GoogleGenAI } = await import("@google/genai");

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: question,
        config: {
          systemInstruction:
            "تو دستیار آموزشی ربات مدرسه رائفتی هستی. به زبان فارسی، دقیق، ساده و قابل فهم پاسخ بده.",
          maxOutputTokens: 800,
        },
      });

      const answer = response.text?.trim();

      if (!answer) {
        throw new Error("Gemini returned an empty response.");
      }

      return ctx.reply(answer.slice(0, 3900), {
        reply_to_message_id: ctx.message.message_id,
      });
    } catch (error) {
      console.error("Gemini API Error:", error);

      return ctx.reply(
        "❌ در دریافت پاسخ از هوش مصنوعی مشکلی پیش آمد. لطفاً کمی بعد دوباره امتحان کنید.",
        { reply_to_message_id: ctx.message.message_id },
      );
    }
  });

  bot.command("botorder", async (ctx) => {
    const commands = [
      "/admins",
      "/groupusername",
      "/botorder",
      "/price",
      "/AskGemini",
      "/homework",
      "/examdate",
    ];

    return ctx.reply(
      "📋 فهرست دستورات ربات:\n\n" +
        commands.map((command, index) => `${index + 1}. ${command}`).join("\n"),
    );
  });

  // -----------------------------
  // نمایش شناسه گروه ثبت‌شده
  // -----------------------------

  bot.command("groupusername", async (ctx) => {
    if (!["group", "supergroup"].includes(ctx.chat.type)) {
      return ctx.reply("⚠️ این دستور فقط در گروه‌ها قابل استفاده است.");
    }

    try {
      const school = getSchoolByGroupId(ctx.chat.id);

      if (!school) {
        return ctx.reply("❌ این گروه در ربات به‌عنوان مدرسه ثبت نشده است.");
      }

      return ctx.reply(
        `🏫 مدرسه: ${school.username}\n\n` +
          `🆔 شناسه گروه ثبت‌شده:\n${school.group_id}`,
      );
    } catch (error) {
      console.error("Group username error:", error);

      return ctx.reply("❌ دریافت اطلاعات گروه ناموفق بود.");
    }
  });

  // -----------------------------
  // نمایش لیست ادمین‌های گروه
  // -----------------------------

  bot.command("admins", async (ctx) => {
    // فقط در گروه قابل اجرا باشد
    if (ctx.chat.type === "private") {
      return ctx.reply("این دستور فقط داخل گروه مدرسه قابل استفاده است.");
    }

    // پیدا کردن مدرسه متصل به گروه فعلی
    const school = getSchoolByGroupId(ctx.chat.id);

    if (!school) {
      return ctx.reply("این گروه هنوز به هیچ مدرسه‌ای متصل نشده است.");
    }

    // دریافت مدیران فقط همین مدرسه
    const managers = getManagersBySchoolId(school.id);

    let message = `👥 مدیران مدرسه ${school.username}\n\n`;

    if (managers.length === 0) {
      message += "هنوز هیچ مدیری برای این مدرسه ثبت نشده است.";
    } else {
      managers.forEach((manager, index) => {
        message += `${index + 1}. ${manager.name}\n`;
        message += `نام کاربری: @${manager.username}\n\n`;
      });
    }

    return ctx.reply(message);
  });

  // -----------------------------
  // قیمت روز ارز، طلا، نفت و رمزارز
  // -----------------------------

  bot.command("price", async (ctx) => {
    if (!["group", "supergroup"].includes(ctx.chat.type)) {
      return ctx.reply("⚠️ این دستور فقط در گروه‌ها قابل استفاده است.");
    }

    try {
      await ctx.sendChatAction("typing");

      const response = await fetch("https://nerkhara.com/api/v1/latest.json", {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!Array.isArray(result.items)) {
        throw new Error("Invalid API response");
      }

      const assets = [
        { id: "usd", name: "🇺🇸 دلار آمریکا", unit: "تومان" },
        { id: "cad", name: "🇨🇦 دلار کانادا", unit: "تومان" },
        { id: "eur", name: "🇪🇺 یورو", unit: "تومان" },
        { id: "gbp", name: "🇬🇧 پوند انگلیس", unit: "تومان" },
        { id: "gold-18k", name: "🟡 طلای ۱۸ عیار", unit: "تومان" },
        { id: "brent", name: "🛢 نفت برنت", unit: "دلار" },
        { id: "usdt", name: "🟢 تتر", unit: "تومان" },
        { id: "btc", name: "₿ بیت‌کوین", unit: "USDT" },
      ];

      const formatPrice = (price) =>
        new Intl.NumberFormat("fa-IR", {
          maximumFractionDigits: 2,
        }).format(price);

      const lines = [];

      for (const asset of assets) {
        const item = result.items.find((i) => i.id === asset.id);

        if (
          !item ||
          typeof item.price !== "number" ||
          !Number.isFinite(item.price) ||
          item.stale
        ) {
          throw new Error(`Invalid or stale price: ${asset.id}`);
        }

        lines.push(
          `${asset.name}\n💰 ${formatPrice(item.price)} ${asset.unit}`,
        );

        if (asset.id === "btc" && Number.isFinite(item.price_irt)) {
          lines.push(`💵 معادل تومانی: ${formatPrice(item.price_irt)} تومان`);
        }
      }

      const updated = result.items
        .filter((item) => assets.some((asset) => asset.id === item.id))
        .map((item) => item.updated_utc)
        .filter(Boolean)
        .sort()
        .pop();

      const updatedDate = updated ? new Date(`${updated}Z`) : null;

      const updatedText =
        updatedDate && !Number.isNaN(updatedDate.getTime())
          ? new Intl.DateTimeFormat("fa-IR", {
              timeZone: "Asia/Tehran",
              dateStyle: "short",
              timeStyle: "short",
            }).format(updatedDate)
          : "نامشخص";

      const message =
        "📊 گزارش قیمت بازار آزاد\n\n" +
        lines.join("\n\n") +
        "\n\n━━━━━━━━━━━━━━\n" +
        `🕒 آخرین به‌روزرسانی: ${updatedText}\n` +
        "📡 منبع: NerkhAra\n" +
        "⚠️ قیمت‌ها نرخ مرجع هستند و ممکن است با قیمت معامله متفاوت باشند.";

      return ctx.reply(message, {
        disable_web_page_preview: true,
      });
    } catch (error) {
      console.error("Price API Error:", error);

      return ctx.reply(
        "❌ دریافت قیمت‌ها با مشکل مواجه شد.\nلطفاً کمی بعد دوباره امتحان کنید.",
      );
    }
  });

  // -----------------------------
  // نمایش پنل متناسب با نقش کاربر
  // -----------------------------
  bot.hears("👥 ادمین‌ها", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const session = getSchoolSession(ctx.from.id);

    if (!session) {
      return ctx.reply("❌ ابتدا وارد حساب مدرسه شوید.", mainMenu);
    }

    const school = getSchoolById(session.school_id);

    if (!school || school.owner_id !== ctx.from.id) {
      return ctx.reply("❌ فقط مالک مدرسه به این بخش دسترسی دارد.");
    }

    const managers = getManagersBySchoolId(school.id);

    const managerList = managers.length
      ? managers
          .map(
            (manager, index) =>
              `${index + 1}. 👤 ${manager.name}\n🔑 @${manager.username}`,
          )
          .join("\n\n")
      : "هنوز مدیری برای این مدرسه ثبت نشده است.";

    return ctx.reply(
      `👥 ادمین‌های مدرسه\n\n` +
        `👑 مالک: ${school.owner_name}\n\n` +
        `🛡 مدیران:\n${managerList}`,
      ownerDashboardMenu,
    );
  });

  // -----------------------------
  // شروع ثبت تکالیف
  // -----------------------------
  bot.hears("📚 تکالیف", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const session = getSchoolSession(ctx.from.id);

    if (!session) {
      return ctx.reply("❌ ابتدا وارد حساب مدرسه شوید.", mainMenu);
    }

    deleteRegistration(ctx.from.id);

    saveRegistration(ctx.from.id, null, "waiting_homework_weekday", {
      schoolId: session.school_id,
    });

    return ctx.reply(
      "📚 ثبت تکالیف\n\nروز موردنظر را انتخاب کنید:",
      weekdayKeyboard("homework"),
    );
  });

  // -----------------------------
  // شروع ثبت امتحان
  // -----------------------------
  bot.hears("📝 امتحان‌ها", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const session = getSchoolSession(ctx.from.id);

    if (!session) {
      return ctx.reply("❌ ابتدا وارد حساب مدرسه شوید.", mainMenu);
    }

    deleteRegistration(ctx.from.id);

    saveRegistration(ctx.from.id, null, "waiting_exam_weekday", {
      schoolId: session.school_id,
    });

    return ctx.reply(
      "📝 ثبت امتحان\n\nروز برگزاری امتحان را انتخاب کنید:",
      weekdayKeyboard("exam"),
    );
  });

  // -----------------------------
  // انتخاب روز تکالیف
  // -----------------------------
  bot.action(/^school:homework:(\d)$/, async (ctx) => {
    const index = Number(ctx.match[1]);
    const userId = ctx.from.id;
    const registration = getRegistration(userId);
    const session = getSchoolSession(userId);

    if (
      !session ||
      !registration ||
      registration.step !== "waiting_homework_weekday" ||
      registration.data.schoolId !== session.school_id ||
      !weekdays[index]
    ) {
      return ctx.answerCbQuery("این درخواست معتبر نیست.", {
        show_alert: true,
      });
    }

    saveRegistration(userId, null, "waiting_homework_task1", {
      schoolId: session.school_id,
      weekday: weekdays[index],
    });

    await ctx.answerCbQuery();

    return ctx.editMessageText(
      `📚 ثبت تکالیف ${weekdays[index]}\n\n` +
        "✏️ تکلیف اول را وارد کنید:\n\n" +
        "مثال: ریاضی، حل تمرین صفحه ۳۰",
    );
  });

  // -----------------------------
  // انتخاب روز امتحان
  // -----------------------------
  bot.action(/^school:exam:(\d)$/, async (ctx) => {
    const index = Number(ctx.match[1]);
    const userId = ctx.from.id;
    const registration = getRegistration(userId);
    const session = getSchoolSession(userId);

    if (
      !session ||
      !registration ||
      registration.step !== "waiting_exam_weekday" ||
      registration.data.schoolId !== session.school_id ||
      !weekdays[index]
    ) {
      return ctx.answerCbQuery("این درخواست معتبر نیست.", {
        show_alert: true,
      });
    }

    saveRegistration(userId, null, "waiting_exam_subjects", {
      schoolId: session.school_id,
      weekday: weekdays[index],
    });

    await ctx.answerCbQuery();

    return ctx.editMessageText(
      `📝 ثبت امتحان ${weekdays[index]}\n\n` +
        "📖 نام درس یا درس‌های امتحان را وارد کنید.\n\n" +
        "مثال: ریاضی و فیزیک",
    );
  });

  // -----------------------------
  // دستورات نمایش تکالیف در گروه
  // -----------------------------
  bot.command("homework", async (ctx) => {
    if (!["group", "supergroup"].includes(ctx.chat.type)) return;

    const school = getSchoolByGroupId(ctx.chat.id);

    if (!school) {
      return ctx.reply("❌ این گروه مدرسه ثبت‌شده نیست.");
    }

    const records = getUpcomingHomeworks(school.id, getTodayISO());

    if (!records.length) {
      return ctx.reply("📚 تکلیف آینده‌ای برای این مدرسه ثبت نشده است.");
    }

    const message = records
      .map(
        (item, index) =>
          `${index + 1}. 📚 ${item.weekday}\n` +
          `📅 تاریخ: ${formatJalaliDate(item.homework_date)}\n\n` +
          `1️⃣ تکلیف اول: ${item.task1}\n` +
          `2️⃣ تکلیف دوم: ${item.task2}\n\n` +
          `👤 ثبت‌کننده: ${item.creator_name}`,
      )
      .join("\n\n━━━━━━━━━━━━━━\n\n");

    return ctx.reply("📚 تکالیف مدرسه\n\n" + message);
  });

  // -----------------------------
  // دستورات نمایش امتحان‌ها در گروه
  // -----------------------------
  bot.command("examdate", async (ctx) => {
    if (!["group", "supergroup"].includes(ctx.chat.type)) return;

    const school = getSchoolByGroupId(ctx.chat.id);

    if (!school) {
      return ctx.reply("❌ این گروه مدرسه ثبت‌شده نیست.");
    }

    const records = getUpcomingExams(school.id, getTodayISO());

    if (!records.length) {
      return ctx.reply("📝 امتحان آینده‌ای برای این مدرسه ثبت نشده است.");
    }

    const message = records
      .map(
        (item, index) =>
          `${index + 1}. 📝 ${item.weekday}\n` +
          `📅 تاریخ: ${formatJalaliDate(item.exam_date)}\n` +
          `📖 درس‌ها: ${item.subjects}\n` +
          `👤 ثبت‌کننده: ${item.creator_name}`,
      )
      .join("\n\n━━━━━━━━━━━━━━\n\n");

    return ctx.reply("📝 امتحان‌های آینده مدرسه\n\n" + message);
  });

  // دریافت پیام‌های متنی
  bot.on("text", async (ctx, next) => {
    if (ctx.chat.type !== "private") return next();

    const userId = ctx.from.id;
    const registration = getRegistration(userId);
    const text = ctx.message.text.trim();

    if (!registration) return next();

    // -----------------------------
    // دریافت تکلیف اول
    // -----------------------------
    if (registration.step === "waiting_homework_task1") {
      if (text.length > 1000) {
        return ctx.reply(
          "❌ متن تکلیف بیش از حد طولانی است. کوتاه‌تر بنویسید.",
        );
      }

      if (text.length < 2) {
        return ctx.reply("❌ متن تکلیف معتبر نیست. دوباره وارد کنید.");
      }

      saveRegistration(userId, null, "waiting_homework_task2", {
        ...registration.data,
        task1: text,
      });

      return ctx.reply(
        "✅ تکلیف اول ثبت شد.\n\n" + "✏️ حالا تکلیف دوم را وارد کنید:",
      );
    }

    // -----------------------------
    // دریافت تکلیف دوم
    // -----------------------------
    if (registration.step === "waiting_homework_task2") {
      if (text.length > 1000) {
        return ctx.reply(
          "❌ متن تکلیف بیش از حد طولانی است. کوتاه‌تر بنویسید.",
        );
      }

      if (text.length < 2) {
        return ctx.reply("❌ متن تکلیف معتبر نیست. دوباره وارد کنید.");
      }

      saveRegistration(userId, null, "waiting_homework_date", {
        ...registration.data,
        task2: text,
      });

      return ctx.reply(
        "✅ تکلیف دوم ثبت شد.\n\n" +
          "📅 حالا تاریخ انجام تکالیف را به شمسی وارد کنید.\n\n" +
          "مثال: ۱۴۰۵/۰۹/۱۵",
      );
    }

    // -----------------------------
    // دریافت تاریخ تکالیف و ذخیره
    // -----------------------------
    if (registration.step === "waiting_homework_date") {
      const date = parseJalaliDate(text);

      if (!date) {
        return ctx.reply(
          "❌ تاریخ معتبر نیست.\n\n" +
            "تاریخ را به شکل سال/ماه/روز وارد کنید.\n" +
            "مثال: ۱۴۰۵/۰۹/۱۵",
        );
      }

      const weekdayIndex = weekdays.indexOf(registration.data.weekday);
      const expectedJsDay = [6, 0, 1, 2, 3][weekdayIndex];

      if (date.weekdayIndex !== expectedJsDay) {
        return ctx.reply(
          `❌ تاریخ واردشده با ${registration.data.weekday} مطابقت ندارد.\n\n` +
            "لطفاً تاریخ درست را وارد کنید.",
        );
      }

      if (date.iso < getTodayISO()) {
        return ctx.reply("❌ تاریخ تکلیف نمی‌تواند مربوط به گذشته باشد.");
      }

      const session = getSchoolSession(userId);
      const school = session && getSchoolById(session.school_id);

      if (
        !school ||
        school.id !== registration.data.schoolId ||
        (school.owner_id !== userId &&
          getManagerByUserId(userId)?.school_id !== school.id)
      ) {
        deleteRegistration(userId);
        return ctx.reply(
          "❌ نشست شما معتبر نیست. دوباره وارد حساب شوید.",
          mainMenu,
        );
      }

      const creatorName = getCreatorName(ctx);

      try {
        createHomework(
          school.id,
          registration.data.weekday,
          date.iso,
          registration.data.task1,
          registration.data.task2,
          userId,
          creatorName,
        );

        await ctx.telegram.sendMessage(
          school.group_id,
          "📚 تکالیف جدید ثبت شد!\n\n" +
            `📅 روز: ${registration.data.weekday}\n` +
            `🗓 تاریخ: ${date.jalali}\n\n` +
            `1️⃣ تکلیف اول:\n${registration.data.task1}\n\n` +
            `2️⃣ تکلیف دوم:\n${registration.data.task2}\n\n` +
            `👤 ثبت‌کننده: ${creatorName}`,
        );

        deleteRegistration(userId);

        return ctx.reply(
          "🎉 تکالیف با موفقیت ثبت شدند و در گروه مدرسه اعلام شدند.",
          school.owner_id === userId
            ? ownerDashboardMenu
            : managerDashboardMenu,
        );
      } catch (error) {
        console.error("Homework registration error:", error);

        return ctx.reply("❌ ثبت تکالیف با خطا مواجه شد. دوباره تلاش کنید.");
      }
    }

    // -----------------------------
    // دریافت نام درس‌های امتحان
    // -----------------------------
    if (registration.step === "waiting_exam_subjects") {
      if (text.length < 2 || text.length > 500) {
        return ctx.reply("❌ نام درس‌ها معتبر نیست. دوباره وارد کنید.");
      }

      saveRegistration(userId, null, "waiting_exam_date", {
        ...registration.data,
        subjects: text,
      });

      return ctx.reply(
        "✅ نام درس‌ها ثبت شد.\n\n" +
          "📅 تاریخ دقیق امتحان را به شمسی وارد کنید.\n\n" +
          "مثال: ۱۴۰۵/۰۹/۱۵",
      );
    }

    // -----------------------------
    // دریافت تاریخ امتحان و ذخیره
    // -----------------------------
    if (registration.step === "waiting_exam_date") {
      const date = parseJalaliDate(text);

      if (!date) {
        return ctx.reply(
          "❌ تاریخ معتبر نیست.\n\n" +
            "تاریخ را به شکل سال/ماه/روز وارد کنید.\n" +
            "مثال: ۱۴۰۵/۰۹/۱۵",
        );
      }

      const weekdayIndex = weekdays.indexOf(registration.data.weekday);
      const expectedJsDay = [6, 0, 1, 2, 3][weekdayIndex];

      if (date.weekdayIndex !== expectedJsDay) {
        return ctx.reply(
          `❌ تاریخ واردشده با ${registration.data.weekday} مطابقت ندارد.\n\n` +
            "لطفاً تاریخ درست را وارد کنید.",
        );
      }

      if (date.iso < getTodayISO()) {
        return ctx.reply("❌ تاریخ امتحان نمی‌تواند مربوط به گذشته باشد.");
      }

      const session = getSchoolSession(userId);
      const school = session && getSchoolById(session.school_id);

      if (
        !school ||
        school.id !== registration.data.schoolId ||
        (school.owner_id !== userId &&
          getManagerByUserId(userId)?.school_id !== school.id)
      ) {
        deleteRegistration(userId);
        return ctx.reply(
          "❌ نشست شما معتبر نیست. دوباره وارد حساب شوید.",
          mainMenu,
        );
      }

      const creatorName = getCreatorName(ctx);

      try {
        createExam(
          school.id,
          registration.data.weekday,
          date.iso,
          registration.data.subjects,
          userId,
          creatorName,
        );

        await ctx.telegram.sendMessage(
          school.group_id,
          "📝 امتحان جدید ثبت شد!\n\n" +
            `📅 روز: ${registration.data.weekday}\n` +
            `🗓 تاریخ: ${date.jalali}\n` +
            `📖 درس‌ها: ${registration.data.subjects}\n\n` +
            `👤 ثبت‌کننده: ${creatorName}`,
        );

        deleteRegistration(userId);

        return ctx.reply(
          "🎉 امتحان با موفقیت ثبت شد و در گروه مدرسه اعلام شد.",
          school.owner_id === userId
            ? ownerDashboardMenu
            : managerDashboardMenu,
        );
      } catch (error) {
        console.error("Exam registration error:", error);

        return ctx.reply("❌ ثبت امتحان با خطا مواجه شد. دوباره تلاش کنید.");
      }
    }

    // -----------------------------
    // ورود مالک: نام کاربری
    // -----------------------------
    if (registration.step === "waiting_owner_username") {
      const username = text.toLowerCase();
      const school = getSchoolByUsername(username);

      if (!school) {
        return ctx.reply("❌ مدرسه‌ای با این نام کاربری پیدا نشد.", loginMenu);
      }

      saveRegistration(userId, null, "waiting_owner_password", { username });

      return ctx.reply("🔐 رمز عبور مدرسه را وارد کنید:", loginMenu);
    }

    // -----------------------------
    // ورود مالک: رمز عبور و درخواست تأیید گروه
    // -----------------------------
    if (registration.step === "waiting_owner_password") {
      const school = getSchoolByUsername(registration.data.username);

      if (!school || school.owner_id !== userId) {
        deleteRegistration(userId);

        return ctx.reply("❌ این حساب متعلق به شما نیست.", mainMenu);
      }

      const valid = await bcrypt.compare(
        ctx.message.text,
        school.password_hash,
      );

      if (!valid) {
        return ctx.reply(
          "❌ رمز عبور اشتباه است. دوباره تلاش کنید:",
          loginMenu,
        );
      }

      // ساخت توکن اختصاصی درخواست ورود
      const approvalToken = crypto.randomBytes(8).toString("hex");

      // ذخیره درخواست ورود در دیتابیس
      saveRegistration(
        userId,
        school.group_id,
        "awaiting_owner_login_approval",
        {
          username: school.username,
          approvalToken,
        },
      );

      try {
        // ارسال درخواست تأیید به گروه مدرسه
        await ctx.telegram.sendMessage(
          school.group_id,
          "🔐 درخواست ورود مالک مدرسه\n\n" +
            `🏫 مدرسه: ${school.title || school.username}\n` +
            `👤 مالک: ${school.owner_name}\n\n` +
            "برای ورود مالک به پنل، مالک اصلی گروه باید درخواست را تأیید کند:",
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "✅ تأیید ورود مالک",
                `school:loginapprove:${approvalToken}`,
              ),
            ],
          ]),
        );

        return ctx.reply(
          "📨 درخواست تأیید ورود به گروه مدرسه ارسال شد.\n\n" +
            "پس از تأیید درخواست توسط مالک اصلی گروه، وارد پنل خواهید شد.",
          loginMenu,
        );
      } catch (error) {
        console.error("Owner login request error:", error);

        deleteRegistration(userId);

        return ctx.reply(
          "❌ ارسال درخواست تأیید به گروه ناموفق بود.\n" +
            "مطمئن شوید ربات هنوز در گروه حضور دارد و اجازه ارسال پیام دارد.",
          mainMenu,
        );
      }
    }

    // -----------------------------
    // ساخت حساب مدیر: نام کاربری مدرسه
    // -----------------------------
    if (registration.step === "waiting_manager_school_username") {
      const school = getSchoolByUsername(text.toLowerCase());

      if (!school) {
        return ctx.reply("❌ مدرسه‌ای با این نام کاربری پیدا نشد.", loginMenu);
      }

      saveRegistration(userId, null, "waiting_manager_school_password", {
        schoolId: school.id,
        username: school.username,
      });

      return ctx.reply("🔐 رمز عبور مدرسه را وارد کنید:", loginMenu);
    }

    // -----------------------------
    // ساخت حساب مدیر: انتخاب نام کاربری
    // -----------------------------
    if (registration.step === "waiting_manager_new_username") {
      const username = text.toLowerCase();

      if (!/^[a-z0-9_]{4,20}$/.test(username)) {
        return ctx.reply(
          "❌ نام کاربری معتبر نیست.\n" +
            "باید ۴ تا ۲۰ کاراکتر و شامل حروف انگلیسی، عدد یا _ باشد.",
          backKeyboard,
        );
      }

      if (isManagerUsernameTaken(username)) {
        return ctx.reply(
          "❌ این نام کاربری قبلاً استفاده شده است. نام دیگری انتخاب کنید.",
          backKeyboard,
        );
      }

      // بررسی مجدد اینکه مدیر حساب دیگری نساخته باشد
      if (getManagerByUserId(userId)) {
        deleteRegistration(userId);

        return ctx.reply("❌ شما قبلاً حساب مدیر ساخته‌اید.", managerLoginMenu);
      }

      try {
        const name = ctx.from.first_name || ctx.from.username || "مدیر";

        const member = await ctx.telegram.getChatMember(
          registration.data.groupId,
          userId,
        );

        const isMember =
          ["creator", "administrator", "member"].includes(member.status) ||
          (member.status === "restricted" && member.is_member);

        if (!isMember) {
          return ctx.reply(
            "❌ شما دیگر عضو گروه این مدرسه نیستید.",
            managerLoginMenu,
          );
        }

        createManager(registration.data.schoolId, userId, name, username);

        saveSchoolSession(userId, registration.data.schoolId);

        deleteRegistration(userId);

        return ctx.reply(
          "🎉 حساب مدیر با موفقیت ساخته شد!\n\n" +
            `👤 نام: ${name}\n` +
            `🔑 نام کاربری اختصاصی: ${username}\n\n` +
            "از این پس می‌توانید با نام کاربری اختصاصی خود وارد شوید.",
          managerDashboardMenu,
        );
      } catch (error) {
        console.error("Manager creation error:", error);

        return ctx.reply("❌ ساخت حساب مدیر با خطا مواجه شد.", mainMenu);
      }
    }

    // -----------------------------
    // ساخت حساب مدیر: بررسی رمز مدرسه
    // -----------------------------
    if (registration.step === "waiting_manager_school_password") {
      const school = getSchoolByUsername(registration.data.username);

      if (!school) {
        deleteRegistration(userId);
        return ctx.reply("❌ مدرسه پیدا نشد.", mainMenu);
      }

      const valid = await bcrypt.compare(
        ctx.message.text,
        school.password_hash,
      );

      if (!valid) {
        return ctx.reply(
          "❌ رمز عبور مدرسه اشتباه است. دوباره تلاش کنید:",
          loginMenu,
        );
      }

      const existingManager = getManagerByUserId(userId);

      if (existingManager) {
        deleteRegistration(userId);

        return ctx.reply("❌ شما قبلاً حساب مدیر ساخته‌اید.", mainMenu);
      }
      saveRegistration(userId, null, "waiting_manager_telegram_id", {
        schoolId: school.id,
        schoolUsername: school.username,
        groupId: school.group_id,
      });

      return ctx.reply(
        "✅ اطلاعات مدرسه تأیید شد.\n\n" +
          "حالا شناسه عددی تلگرام خود را وارد کنید.\n\n" +
          `🆔 شناسه حساب شما: ${userId}\n\n` +
          "⚠️ برای تأیید هویت، همین شناسه را ارسال کنید.",
        backKeyboard,
      );
    }

    // -----------------------------
    // ساخت حساب مدیر: بررسی شناسه تلگرام
    // -----------------------------
    if (registration.step === "waiting_manager_telegram_id") {
      const telegramId = text;

      // بررسی عددی بودن شناسه
      if (!/^\d+$/.test(telegramId)) {
        return ctx.reply(
          "❌ شناسه تلگرام معتبر نیست.\nلطفاً فقط عدد وارد کنید.",
          backKeyboard,
        );
      }

      // تطبیق شناسه واردشده با حساب واقعی کاربر
      if (telegramId !== String(userId)) {
        return ctx.reply(
          "❌ این شناسه متعلق به حساب تلگرام شما نیست.\n\n" +
            `🆔 شناسه صحیح شما: ${userId}`,
          backKeyboard,
        );
      }

      // بررسی نداشتن حساب قبلی
      const existingManager = getManagerByUserId(userId);

      if (existingManager) {
        deleteRegistration(userId);

        return ctx.reply("❌ شما قبلاً حساب مدیر ساخته‌اید.", managerLoginMenu);
      }

      try {
        // بررسی عضویت کاربر در گروه مدرسه
        const member = await ctx.telegram.getChatMember(
          registration.data.groupId,
          userId,
        );

        const isMember =
          ["creator", "administrator", "member"].includes(member.status) ||
          (member.status === "restricted" && member.is_member);

        if (!isMember) {
          return ctx.reply(
            "❌ شما عضو گروه این مدرسه نیستید.\n\n" +
              "ابتدا وارد گروه مدرسه شوید و دوباره تلاش کنید.",
            backKeyboard,
          );
        }

        // رفتن به مرحله انتخاب نام کاربری
        saveRegistration(userId, null, "waiting_manager_new_username", {
          schoolId: registration.data.schoolId,
          schoolUsername: registration.data.schoolUsername,
          groupId: registration.data.groupId,
        });

        return ctx.reply(
          "✅ شناسه تلگرام و عضویت شما تأیید شد.\n\n" +
            "حالا یک نام کاربری اختصاصی برای حساب مدیریت خود انتخاب کنید.\n\n" +
            "نام کاربری باید ۴ تا ۲۰ کاراکتر و شامل حروف انگلیسی، عدد یا _ باشد.",
          backKeyboard,
        );
      } catch (error) {
        console.error("Manager Telegram ID verification error:", error);

        return ctx.reply(
          "❌ بررسی عضویت شما در گروه ناموفق بود.\n" +
            "مطمئن شوید ربات در گروه حضور دارد و دوباره تلاش کنید.",
          backKeyboard,
        );
      }
    }

    // ورود مدیر: نام کاربری اختصاصی
    // -----------------------------
    if (registration.step === "waiting_manager_username") {
      const username = text.toLowerCase();
      const manager = getManagerByUsername(username);

      if (!manager || manager.user_id !== userId) {
        return ctx.reply(
          "❌ حساب مدیری با این نام کاربری برای شما پیدا نشد.",
          loginMenu,
        );
      }

      const schoolUsername = getSchoolUsernameById(manager.school_id);
      const school = getSchoolByUsername(schoolUsername);

      if (!school) {
        deleteRegistration(userId);

        return ctx.reply("❌ مدرسه پیدا نشد.", mainMenu);
      }

      // بررسی عضویت فعلی در گروه مدرسه
      try {
        const member = await ctx.telegram.getChatMember(
          school.group_id,
          userId,
        );

        const isMember =
          ["creator", "administrator", "member"].includes(member.status) ||
          (member.status === "restricted" && member.is_member);

        if (!isMember) {
          return ctx.reply("❌ شما دیگر عضو گروه این مدرسه نیستید.", loginMenu);
        }
      } catch (error) {
        console.error("Manager membership check error:", error);

        return ctx.reply("❌ بررسی عضویت شما در گروه ناموفق بود.", loginMenu);
      }

      saveSchoolSession(userId, school.id);
      deleteRegistration(userId);

      return ctx.reply(
        "🎉 ورود مدیر با موفقیت انجام شد!\n\n" +
          `🏫 مدرسه: ${school.title || school.username}\n` +
          `👤 مدیر: ${manager.name}\n` +
          `🔑 نام کاربری: ${manager.username}\n\n` +
          "به پنل مدیریت خوش آمدید.",
        managerDashboardMenu,
      );
    }

    // -----------------------------
    // درخواست بازیابی رمز
    // -----------------------------
    if (registration.step === "waiting_forgot_username") {
      const school = getSchoolByUsername(text.toLowerCase());

      if (!school || school.owner_id !== userId) {
        return ctx.reply(
          "❌ مدرسه‌ای با این مشخصات برای حساب شما پیدا نشد.",
          loginMenu,
        );
      }

      const token = crypto.randomBytes(8).toString("hex");

      saveRegistration(
        userId,
        school.group_id,
        "awaiting_password_reset_approval",
        {
          username: school.username,
          resetToken: token,
        },
      );

      try {
        await ctx.telegram.sendMessage(
          school.group_id,
          "🔒 درخواست بازیابی رمز عبور مدرسه\n\n" +
            `نام کاربری: ${school.username}\n` +
            "مالک مدرسه درخواست تغییر رمز عبور داده است.",
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "✅ تأیید تغییر رمز عبور",
                `school:reset:${token}`,
              ),
            ],
          ]),
        );

        return ctx.reply("📨 درخواست تأیید به گروه مدرسه ارسال شد.", loginMenu);
      } catch (error) {
        console.error("Password reset request error:", error);
        deleteRegistration(userId);

        return ctx.reply("❌ ارسال درخواست به گروه ناموفق بود.", mainMenu);
      }
    }

    // -----------------------------
    // ثبت رمز جدید مالک
    // -----------------------------
    if (registration.step === "waiting_new_password") {
      const password = ctx.message.text;

      if (
        password.length < 8 ||
        password.length > 50 ||
        Buffer.byteLength(password, "utf8") > 72
      ) {
        return ctx.reply(
          "❌ رمز باید حداقل ۸ و حداکثر ۵۰ کاراکتر باشد.",
          loginMenu,
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);

      updateSchoolPassword(registration.data.username, passwordHash);

      deleteRegistration(userId);

      return ctx.reply(
        "✅ رمز عبور مدرسه با موفقیت تغییر کرد.\n\n" +
          "اکنون می‌توانید با رمز جدید وارد حساب شوید.",
        mainMenu,
      );
    }

    // -----------------------------
    // ثبت نام کاربری مدرسه
    // -----------------------------
    if (registration.step === "waiting_username") {
      const username = text.toLowerCase();

      if (!/^[a-z0-9_]{4,20}$/.test(username)) {
        return ctx.reply(
          "❌ نام کاربری باید ۴ تا ۲۰ کاراکتر و شامل حروف انگلیسی، عدد یا _ باشد.",
          backKeyboard,
        );
      }

      if (isSchoolUsernameTaken(username)) {
        return ctx.reply(
          "❌ این نام کاربری قبلاً استفاده شده است.",
          backKeyboard,
        );
      }

      try {
        createSchool(
          registration.group_id,
          registration.data.ownerId,
          registration.data.ownerName,
          username,
          registration.data.passwordHash,
        );

        deleteRegistration(userId);

        return ctx.reply(
          "🎉 مدرسه با موفقیت ایجاد شد!\n\n" +
            `🏫 نام گروه: ${registration.data.groupTitle}\n` +
            `👤 مالک مدرسه: ${registration.data.ownerName}\n\n` +
            `🔑 نام کاربری: ${username}\n` +
            "🔒 رمز عبور: ••••••••••\n\n" +
            "برای ورود، به صفحه اصلی برگردید و گزینه ورود به مدرسه را انتخاب کنید.",
          mainMenu,
        );
      } catch (error) {
        console.error("School creation error:", error);

        return ctx.reply("❌ ثبت مدرسه با خطا مواجه شد.", backKeyboard);
      }
    }

    // -----------------------------
    // ثبت رمز اولیه مدرسه
    // -----------------------------
    if (registration.step === "waiting_password") {
      const password = ctx.message.text;

      if (
        password.length < 8 ||
        password.length > 50 ||
        Buffer.byteLength(password, "utf8") > 72
      ) {
        return ctx.reply(
          "❌ رمز باید حداقل ۸ و حداکثر ۵۰ کاراکتر باشد.",
          backKeyboard,
        );
      }

      try {
        const passwordHash = await bcrypt.hash(password, 12);

        saveRegistration(userId, registration.group_id, "waiting_username", {
          ...registration.data,
          passwordHash,
        });

        return ctx.reply(
          "✅ رمز عبور ثبت شد.\n\n" +
            "حالا یک نام کاربری برای مدرسه انتخاب کنید.",
          backKeyboard,
        );
      } catch (error) {
        console.error("Password hashing error:", error);

        return ctx.reply("❌ ذخیره رمز عبور با خطا مواجه شد.", backKeyboard);
      }
    }

    // -----------------------------
    // دریافت شناسه گروه
    // -----------------------------
    if (registration.step !== "waiting_group_id") {
      return next();
    }

    const groupIdText = text;
    const groupId = Number(groupIdText);

    if (
      !/^-?\d+$/.test(groupIdText) ||
      !Number.isSafeInteger(groupId) ||
      groupId >= 0
    ) {
      return ctx.reply("❌ شناسه گروه معتبر نیست.", backKeyboard);
    }

    try {
      const botInfo = await ctx.telegram.getMe();

      const botMember = await ctx.telegram.getChatMember(groupId, botInfo.id);

      if (
        botMember.status !== "administrator" &&
        botMember.status !== "creator"
      ) {
        return ctx.reply("❌ ربات در گروه مدیر نیست.", backKeyboard);
      }

      const chat = await ctx.telegram.getChat(groupId);

      if (!["group", "supergroup"].includes(chat.type)) {
        return ctx.reply("❌ شناسه واردشده مربوط به گروه نیست.", backKeyboard);
      }

      const owner = await ctx.telegram.getChatMember(groupId, userId);

      if (owner.status !== "creator") {
        return ctx.reply(
          "❌ فقط مالک اصلی گروه می‌تواند مدرسه ایجاد کند.",
          backKeyboard,
        );
      }

      saveGroup(chat.id, chat.title || "بدون نام", chat.username || null);

      const approvalToken = crypto.randomBytes(8).toString("hex");

      saveRegistration(userId, chat.id, "awaiting_owner_approval", {
        approvalToken,
        groupTitle: chat.title || "بدون نام",
      });

      await ctx.telegram.sendMessage(
        chat.id,
        "🏫 درخواست ایجاد مدرسه برای این گروه ثبت شده است.\n\n" +
          "مالک گروه برای تأیید درخواست روی دکمه زیر بزند:",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ تأیید مالکیت و ادامه",
              `school:approve:${approvalToken}`,
            ),
          ],
        ]),
      );

      return ctx.reply(
        "✅ درخواست تأیید مالکیت به گروه ارسال شد.\nپس از تأیید، ادامه مراحل را انجام دهید.",
        backKeyboard,
      );
    } catch (error) {
      console.error("School group verification error:", error);

      return ctx.reply(
        "❌ بررسی گروه با خطا مواجه شد.\nشناسه گروه و مدیر بودن ربات را بررسی کنید.",
        backKeyboard,
      );
    }
  });

  // -----------------------------
  // تأیید مالکیت گروه
  // -----------------------------
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

      const owner = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);

      if (owner.status !== "creator") {
        return ctx.answerCbQuery("فقط مالک اصلی گروه اجازه تأیید دارد.", {
          show_alert: true,
        });
      }

      await ctx.answerCbQuery("مالکیت تأیید شد.");

      saveRegistration(ctx.from.id, registration.group_id, "waiting_password", {
        ...registration.data,
        ownerId: ctx.from.id,
        ownerName: ctx.from.first_name || ctx.from.username || "مالک گروه",
      });

      await ctx.editMessageText(
        "✅ مالکیت گروه تأیید شد.\n\n" +
          "ادامه مراحل را در گفت‌وگوی خصوصی ربات انجام دهید.",
      );

      await ctx.telegram.sendMessage(
        ctx.from.id,
        "🔐 مالکیت گروه تأیید شد.\n\n" + "یک رمز عبور برای مدرسه انتخاب کنید:",
        backKeyboard,
      );
    } catch (error) {
      console.error("School approval error:", error);

      await ctx.answerCbQuery("هنگام تأیید خطایی رخ داد.", {
        show_alert: true,
      });
    }
  });

  // -----------------------------
  // تأیید بازیابی رمز مالک
  // -----------------------------
  bot.action(/^school:reset:([a-f0-9]{16})$/, async (ctx) => {
    const token = ctx.match[1];
    const userId = ctx.from.id;

    try {
      const registration = getRegistration(userId);

      if (
        !registration ||
        registration.step !== "awaiting_password_reset_approval" ||
        registration.data.resetToken !== token ||
        registration.group_id !== ctx.chat.id
      ) {
        return ctx.answerCbQuery("این درخواست معتبر نیست.", {
          show_alert: true,
        });
      }

      const school = getSchoolByUsername(registration.data.username);

      if (!school || school.owner_id !== userId) {
        return ctx.answerCbQuery("فقط مالک مدرسه اجازه تأیید دارد.", {
          show_alert: true,
        });
      }

      const member = await ctx.telegram.getChatMember(ctx.chat.id, userId);

      if (member.status !== "creator") {
        return ctx.answerCbQuery("فقط مالک اصلی گروه می‌تواند تأیید کند.", {
          show_alert: true,
        });
      }

      saveRegistration(userId, school.group_id, "waiting_new_password", {
        username: school.username,
      });

      await ctx.answerCbQuery("درخواست تأیید شد.");

      await ctx.editMessageText(
        "✅ درخواست تغییر رمز عبور توسط مالک مدرسه تأیید شد.",
      );

      await ctx.telegram.sendMessage(
        userId,
        "🔒 تأیید انجام شد.\n\n" + "رمز عبور جدید مدرسه را وارد کنید:",
        loginMenu,
      );
    } catch (error) {
      console.error("Password reset approval error:", error);

      await ctx.answerCbQuery("هنگام تأیید خطایی رخ داد.", {
        show_alert: true,
      });
    }
  });

  // -----------------------------
  // تأیید ورود مالک توسط مالک اصلی گروه
  // -----------------------------
  bot.action(/^school:loginapprove:([a-f0-9]{16})$/, async (ctx) => {
    const token = ctx.match[1];
    const userId = ctx.from.id;

    try {
      // دریافت درخواست ورود کاربر تأییدکننده
      const registration = getRegistration(userId);

      if (
        !registration ||
        registration.step !== "awaiting_owner_login_approval" ||
        registration.data.approvalToken !== token ||
        registration.group_id !== ctx.chat.id
      ) {
        return ctx.answerCbQuery(
          "❌ این درخواست معتبر نیست یا منقضی شده است.",
          { show_alert: true },
        );
      }

      // بررسی اطلاعات مدرسه
      const school = getSchoolByUsername(registration.data.username);

      if (
        !school ||
        school.owner_id !== userId ||
        school.group_id !== ctx.chat.id
      ) {
        return ctx.answerCbQuery(
          "❌ فقط مالک اصلی این مدرسه اجازه تأیید دارد.",
          { show_alert: true },
        );
      }

      // بررسی مالک اصلی بودن کاربر در گروه
      const owner = await ctx.telegram.getChatMember(ctx.chat.id, userId);

      if (owner.status !== "creator") {
        return ctx.answerCbQuery(
          "❌ فقط مالک اصلی گروه می‌تواند درخواست را تأیید کند.",
          { show_alert: true },
        );
      }

      // ثبت ورود مالک
      saveSchoolSession(userId, school.id);

      // حذف درخواست موقت
      deleteRegistration(userId);

      await ctx.answerCbQuery("✅ ورود مالک تأیید شد.");

      await ctx.editMessageText(
        "✅ درخواست ورود مالک تأیید شد.\n\n" +
          `🏫 مدرسه: ${school.title || school.username}\n` +
          "👑 مالک اکنون می‌تواند وارد پنل شود.",
      );

      // ارسال پیام ورود موفق به مالک
      await ctx.telegram.sendMessage(
        userId,
        "🎉 ورود شما با موفقیت تأیید شد!\n\n" +
          `🏫 مدرسه: ${school.title || school.username}\n` +
          "👑 نقش: مالک مدرسه\n\n" +
          "به پنل مالک خوش آمدید.",
        ownerDashboardMenu,
      );
    } catch (error) {
      console.error("Owner login approval error:", error);

      await ctx.answerCbQuery("❌ هنگام تأیید درخواست خطایی رخ داد.", {
        show_alert: true,
      });
    }
  });
};

module.exports = schoolHandler;
