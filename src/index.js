const { Client, Events, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const SATISFACTORY_APP_ID = 526870;
const DAILY_CHECK_HOUR_UTC = 6;
const SATISFACTORY_COMMAND = "/satisfactory";
const ERROR_MESSAGE = "Error checking the Steam page. Please try again later.";
const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

if (!token) {
    throw new Error("DISCORD_TOKEN is required. Add it to a local .env file.");
}

if (!channelId) {
    throw new Error("DISCORD_CHANNEL_ID is required. Add it to a local .env file.");
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

async function getSatisfactoryDiscount() {
    const params = new URLSearchParams({
        appids: String(SATISFACTORY_APP_ID),
        filters: "price_overview",
    });

    const response = await fetch(
        `https://store.steampowered.com/api/appdetails?${params}`,
    );

    if (!response.ok) {
        throw new Error(`Steam API responded with ${response.status}`);
    }

    const appDetails = await response.json();
    const details = appDetails[String(SATISFACTORY_APP_ID)];

    if (!details?.success) {
        throw new Error("Steam API did not return Satisfactory price details");
    }

    return details.data?.price_overview ?? null;
}

function formatSatisfactoryDiscount(priceOverview) {
    if (!priceOverview) {
        return "I couldn't find current Steam pricing for Satisfactory.";
    }

    if (!priceOverview.discount_percent) {
        return `Satisfactory is not currently reduced on Steam. Current price: ${priceOverview.final_formatted}.`;
    }

    return `Satisfactory is currently reduced by ${priceOverview.discount_percent}% on Steam: ${priceOverview.initial_formatted} -> ${priceOverview.final_formatted}.`;
}

async function replyWithSatisfactoryDiscount(message) {
    try {
        const priceOverview = await getSatisfactoryDiscount();
        await message.reply(formatSatisfactoryDiscount(priceOverview));
    } catch (error) {
        console.error(error);
        await message.reply(ERROR_MESSAGE);
    }
}

async function postDailySatisfactoryDiscount(channel) {
    try {
        const priceOverview = await getSatisfactoryDiscount();
        const discountMessage = formatSatisfactoryDiscount(priceOverview);

        console.log(discountMessage);
        await channel.send(discountMessage);
    } catch (error) {
        console.error(error);
        console.log(ERROR_MESSAGE);
    }
}

function getDelayUntilDailyCheck() {
    const now = new Date();
    const nextCheck = new Date(now);

    nextCheck.setUTCHours(DAILY_CHECK_HOUR_UTC, 0, 0, 0);

    if (nextCheck <= now) {
        nextCheck.setUTCDate(nextCheck.getUTCDate() + 1);
    }

    return nextCheck.getTime() - now.getTime();
}

function scheduleDailySatisfactoryDiscount(channel) {
    setTimeout(async () => {
        await postDailySatisfactoryDiscount(channel);
        scheduleDailySatisfactoryDiscount(channel);
    }, getDelayUntilDailyCheck());
}

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);

    const channel = await readyClient.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
        throw new Error(`DISCORD_CHANNEL_ID ${channelId} is not a text channel.`);
    }

    scheduleDailySatisfactoryDiscount(channel);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.content.trim().toLowerCase() === SATISFACTORY_COMMAND) {
        console.log(
            `Command used: ${SATISFACTORY_COMMAND} by ${message.author.tag} in #${message.channel.name}`,
        );
        await replyWithSatisfactoryDiscount(message);
    }
});

client.login(token);
