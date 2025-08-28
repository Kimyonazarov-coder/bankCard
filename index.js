const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const sqlite3 = require("sqlite3").verbose();
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const botToken = process.env.BOT_TOKEN;
const port = process.env.PORT || 3000;
const url = process.env.URL;

const app = express();
app.use(express.json());

// ✅ Webhook bilan ishlash uchun
const bot = new TelegramBot(botToken, { webHook: true });

// ✅ Telegramga to‘g‘ri webhook URL yuborish
bot.setWebHook(`${url}/webhook/${botToken}`);

// 🔗 Webhook route
app.post(`/webhook/${botToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ======================= DB =========================
const db = new sqlite3.Database("./users.db");
const users = {};

// ======================= CHANNEL CHECK =========================
const CHANNEL_ID = "@kimyonazarovuz"; 

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

async function checkSubscription(chatId) {
  const subscribed = await isSubscribed(chatId);
  if (!subscribed) {
    bot.sendMessage(
      chatId,
      `❌ Botdan foydalanish uchun kanalimizga obuna bo'ling:\n\n👉 <a href="https://t.me/kimyonazarovuz">KimyonazarovUZ</a>\n\n✅ Obuna bo'lgach, /start buyrug'ini qaytadan yuboring.`,
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
    return false;
  }
  return true;
}

// ======================= BOT COMMANDS =========================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (!(await checkSubscription(chatId))) return;

  users[chatId] = { step: "password" };

  bot.sendMessage(chatId, `
Assalomu alaykum <b>${msg.from.first_name}</b> 👋

Men Karta Ma'lumotlarini olib beruvchi botman! 💳

Menga karta raqam tashlasangiz bo'ldi.

Misol: 
<code>9860120163319797</code>
`, { parse_mode: "HTML" });

  setTimeout(() => {
    bot.sendMessage(chatId, "Iltimos karta raqamini kiriting:");
  }, 100);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim().replace(/\s+/g, "");

  if (!(await checkSubscription(chatId))) return;

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
            if (err) console.error("DB Xato:", err.message);
            else console.log("Foydalanuvchi saqlandi!");
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
        bot.sendMessage(chatId, "❌ Karta topilmadi yoki noto'g'ri raqam.");
      }
    } catch (err) {
      console.error("API xato:", err.message);
      bot.sendMessage(chatId, "⚠️ Xatolik yuz berdi. Keyinroq urinib ko'ring.");
    }
  }
});

// ======================= API ROUTES =========================
app.get("/api/peoples", (req, res) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// ======================= FRONT PAGE =========================
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kimyonazarov's Bot</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white min-h-screen flex flex-col items-center justify-center px-4">
  <h1 class="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-6 text-center">
    Kimyonazarov's School Bot
  </h1>
  <p class="text-lg md:text-xl text-gray-300 mb-8 text-center max-w-2xl leading-relaxed">
    Bu Telegram bot maktab o'quvchilari uchun maxsus ishlab chiqilgan.<br>
    O'quvchilar o'z ma'lumotlarini kiritish orqali sinf tizimida ro'yxatdan o'tishadi.<br>
    Ma'lumotlar xavfsiz saqlanadi.
  </p>
  <a href="https://t.me/m_kimyonazarov" target="_blank"
     class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300 ease-in-out shadow-md">
    📲 Admin bilan bog'lanish
  </a>
  <footer class="mt-10 text-sm text-gray-500 absolute bottom-4 text-center">
    &copy; 2025 Kimyonazarov. Barcha huquqlar himoyalangan.
  </footer>
</body>
</html>`);
});

// ======================= START SERVER =========================
app.listen(port, () => {
  console.log(`✅ Bot running on port ${port}`);
});
