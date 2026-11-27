
const { Telegraf } = require("telegraf");
const config = require("./config/env");

const bot = new Telegraf(config.botToken);

module.exports = bot;
