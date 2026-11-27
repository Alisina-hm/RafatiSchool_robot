const dotenv = require("dotenv");

dotenv.config();

const config = {
  botToken: process.env.BOT_TOKEN,
};

module.exports = config;
