const { Markup } = require("telegraf");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

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

// منوی پنل
const dashboardMenu = Markup.keyboard([
  [LOGOUT_BUTTON],
  [BACK_BUTTON],
]).resize();

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

    const existingManager = getManagerByUserId(ctx.from.id);

    if (existingManager) {
      saveRegistration(ctx.from.id, null, "waiting_manager_username");

      return ctx.reply(
        "👨‍💼 ورود مدیر مدرسه\n\n" + "نام کاربری اختصاصی خود را وارد کنید:",
        loginMenu,
      );
    }

    saveRegistration(ctx.from.id, null, "waiting_manager_school_username");

    await ctx.reply(
      "👨‍💼 ساخت حساب مدیر\n\n" + "ابتدا نام کاربری مدرسه را وارد کنید:",
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

  // دریافت پیام‌های متنی
  bot.on("text", async (ctx, next) => {
    if (ctx.chat.type !== "private") return next();

    const userId = ctx.from.id;
    const registration = getRegistration(userId);
    const text = ctx.message.text.trim();

    if (!registration) return next();

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
    // ورود مالک: رمز عبور
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

      saveSchoolSession(userId, school.id);
      deleteRegistration(userId);

      return ctx.reply(
        "✅ ورود مالک با موفقیت انجام شد!\n\n" +
          `🏫 مدرسه: ${school.title || school.username}\n` +
          "👑 نقش: مالک مدرسه\n\n" +
          "به پنل مالک خوش آمدید.",
        dashboardMenu,
      );
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

      saveRegistration(userId, null, "waiting_manager_new_username", {
        schoolId: school.id,
        schoolUsername: school.username,
      });

      return ctx.reply(
        "✅ رمز عبور صحیح است.\n\n" +
          "حالا یک نام کاربری اختصاصی برای حساب مدیریت خود انتخاب کنید.\n" +
          "نام کاربری باید ۴ تا ۲۰ کاراکتر و شامل حروف انگلیسی، عدد یا _ باشد.",
        backKeyboard,
      );
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

      try {
        const name = ctx.from.first_name || ctx.from.username || "مدیر";

        createManager(registration.data.schoolId, userId, name, username);

        saveSchoolSession(userId, registration.data.schoolId);

        deleteRegistration(userId);

        return ctx.reply(
          "🎉 حساب مدیر با موفقیت ساخته شد!\n\n" +
            `👤 نام: ${name}\n` +
            `🔑 نام کاربری شما: ${username}\n` +
            "🔒 رمز عبور: همان رمز مدرسه\n\n" +
            "از این پس می‌توانید با نام کاربری اختصاصی خود و رمز مدرسه وارد شوید.",
          dashboardMenu,
        );
      } catch (error) {
        console.error("Manager creation error:", error);

        return ctx.reply("❌ ساخت حساب مدیر با خطا مواجه شد.", mainMenu);
      }
    }

    // -----------------------------
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

      saveRegistration(userId, null, "waiting_manager_password", { username });

      return ctx.reply("🔐 رمز عبور مدرسه را وارد کنید:", loginMenu);
    }

    // -----------------------------
    // ورود مدیر: رمز عبور مدرسه
    // -----------------------------
    if (registration.step === "waiting_manager_password") {
      const manager = getManagerByUsername(registration.data.username);

      if (!manager || manager.user_id !== userId) {
        deleteRegistration(userId);
        return ctx.reply("❌ حساب مدیر پیدا نشد.", mainMenu);
      }

      const school = getSchoolByUsername(
        // نام کاربری مدرسه از شناسه مدرسه به دست می‌آید
        getSchoolUsernameById(manager.school_id),
      );

      if (!school) {
        deleteRegistration(userId);
        return ctx.reply("❌ مدرسه پیدا نشد.", mainMenu);
      }

      const valid = await bcrypt.compare(
        ctx.message.text,
        school.password_hash,
      );

      if (!valid) {
        return ctx.reply("❌ رمز عبور مدرسه اشتباه است.", loginMenu);
      }

      saveSchoolSession(userId, school.id);
      deleteRegistration(userId);

      return ctx.reply(
        "✅ ورود مدیر با موفقیت انجام شد!\n\n" +
          `🏫 مدرسه: ${school.title || school.username}\n` +
          `👤 مدیر: ${manager.name}\n` +
          "👨‍💼 نقش: مدیر مدرسه\n\n" +
          "به پنل مدیریت خوش آمدید.",
        dashboardMenu,
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
};

module.exports = schoolHandler;
