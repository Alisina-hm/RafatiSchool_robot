const bot = require("./bot");
const startHandler = require("./handlers/start");
const schoolHandler = require("./handlers/school");

startHandler(bot);
schoolHandler(bot);

bot
  .launch()
  .then(() => {
    console.log("Modexa is running...");
  })
  .catch((error) => {
    console.error("Bot launch error:", error);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
