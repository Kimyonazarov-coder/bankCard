const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const sqlite3 = require("sqlite3").verbose();
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const botToken = process.env.BOT_TOKEN;
const port = process.env.PORT || 3000;
const url = process.env.url;

const app = express();
app.use(express.json());

const bot = new TelegramBot(botToken, { polling: true });

// ✅ Users obyektini e’lon qilamiz
const users = {};

// ✅ SQLite ochish
const db = new sqlite3.Database("./users.db");

// ✅ Jadvalni yaratib qo‘yish (agar mavjud bo‘lmasa)
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    cardnumber TEXT,
    owner TEXT,
    bank TEXT
  )
`);

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  users[chatId] = { step: "password" };

  bot.sendMessage(chatId, `Assalomu alaykum ${msg.from.first_name}`, {
    parse_mode: "HTML",
  });

  setTimeout(() => {
    bot.sendMessage(chatId, "Iltimos karta raqamini kiriting (16 ta raqam):");
  }, 500);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim().replace(/\s+/g, ""); // bo‘sh joylarni olib tashlaymiz

  // ✅ faqat 16 ta raqam bo‘lsa
  if (/^\d{16}$/.test(text)) {
    try {
      bot.sendMessage(chatId, "⏳ Karta tekshirilmoqda...");

      const { data } = await axios.get(
        `https://reposu.org/payme/card/${text}`
      );

      if (data.success) {
        const { owner, mask, bank, type } = data.result;

        // ✅ Duplicate xato chiqmasligi uchun OR REPLACE ishlatamiz
        db.run(
          `
          INSERT OR REPLACE INTO users (id, username, cardnumber, owner, bank)
          VALUES (?, ?, ?, ?, ?)
        `,
          [msg.from.id, msg.from.username, text, owner, bank],
          (err) => {
            if (err) {
              console.error("DB Xato:", err.message);
            } else {
              console.log("Foydalanuvchi saqlandi!");
            }
          }
        );

        const cardInfo = `
💳 <b>Karta ma'lumotlari</b>

👤 Egasi: <b>${owner}</b>
🔢 Raqam: <b>${mask}</b>
🏦 Bank: <b>${bank}</b>
📌 Turi: <b>${type}</b>
        `.trim();

        bot.sendMessage(chatId, cardInfo, { parse_mode: "HTML" });
      } else {
        bot.sendMessage(chatId, "❌ Karta topilmadi yoki noto‘g‘ri raqam.");
      }
    } catch (err) {
      console.error("API xato:", err.message);
      bot.sendMessage(chatId, "⚠️ Xatolik yuz berdi. Keyinroq urinib ko‘ring.");
    }
    return;
  }
});

setInterval(() => {
  axios
    .get(`${url}`)
    .then(() => console.log("🔄 Self-ping OK"))
    .catch((err) => console.error("❌ Self-ping error:", err.message));
}, 60 * 1000);

app.get("/", (req, res) => {
  res.send("<h1>Kimyonazarov's Bot ishlayapti 🚀</h1>");
});

app.listen(port, () => {
  console.log(`Bot running on port ${port}`);
});
