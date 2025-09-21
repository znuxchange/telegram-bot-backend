require("dotenv").config();
const path = require('path');
const { Telegraf, Markup } = require("telegraf");
const express = require('express');
const bodyParser = require("body-parser");
const axios = require("axios");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
const port = process.env.PORT || 4040;
const { BOT_TOKEN, SERVER_URL } = process.env;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const URI = `/webhook/${BOT_TOKEN}`;
const WEBHOOK_URL = `${SERVER_URL}${URI}`;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.json());

const init = async () => {
    try {
        const res = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
        console.log(res.data);
    } catch (error) {
        console.error('Error setting webhook:', error);
    }
};

app.listen(port, async () => {
    console.log('App is running on port', port);
    await init();
});

const bot = new Telegraf(BOT_TOKEN);
const web_link = "https://taskoriabot.com";
const community_link = "https://t.me/taskoriaann";

bot.start(async (ctx) => {
    const startPayload = ctx.startPayload;
    const urlSent = `${web_link}?ref=${startPayload}`;
    const user = ctx.message.from;
    const userName = user.username ? `@${user.username}` : user.first_name;

    const userDocRef = db.collection('telegramUsers').doc(user.id.toString());

    try {
        // Create or get the user's document
        await userDocRef.set({
            id: user.id.toString(),
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name || null,
            joinDate: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // Check for a referral payload
        if (startPayload && startPayload.startsWith('r')) {
            const referrerId = startPayload.substring(1);
            const referrerRef = db.collection('telegramUsers').doc(referrerId);
            
            // Check if the referrer exists to avoid errors
            const referrerDoc = await referrerRef.get();
            if (referrerDoc.exists) {
                // Atomically increment the referrer's count
                await referrerRef.update({
                    referralsCount: admin.firestore.FieldValue.increment(1),
                });
                console.log(`Successfully incremented referral count for user: ${referrerId}`);
            }
        }

        await ctx.replyWithPhoto(
            { source: 'public/like.jpg' },
            {
                caption: `*Hey, ${userName}! Welcome to NewCats!*\nHow cool is your Cat?\nGot friends, relatives, co-workers?\nBring them all into the game now.\nMore buddies, more coins.`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✨Start now!✨", web_app: { url: urlSent } }],
                        [{ text: "👥Join Community👥", url: community_link }]
                    ],
                },
            }
        );
    } catch (error) {
        if (error.response && error.response.data && error.response.data.description === 'Forbidden: bot was blocked by the user') {
            console.log(`Failed to send message to ${userName} (${user.id}): bot was blocked by the user.`);
        } else {
            console.error(`Failed to send message to ${userName} (${user.id}):`, error);
        }
    }
});

app.post(URI, (req, res) => {
    bot.handleUpdate(req.body);
    res.status(200).send('Received Telegram webhook');
});

app.get("/", (req, res) => {
    res.send("Hello, I am working fine.");
});

app.get('/webhook', (req, res) => {
    res.send('Hey, Bot is awake!');
});
    bot.handleUpdate(req.body);
    res.status(200).send('Received Telegram webhook');
});

app.get("/", (req, res) => {
    res.send("Hello, I am working fine.");
});

app.get('/webhook', (req, res) => {
    res.send('Hey, Bot is awake!');
});
