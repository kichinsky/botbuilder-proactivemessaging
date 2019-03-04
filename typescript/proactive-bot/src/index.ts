// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { config } from "dotenv";
import * as path from "path";
import * as restify from "restify";

import { BotFrameworkAdapter } from "botbuilder";
import { BotConfiguration, IEndpointService } from "botframework-config";

import { ProactiveBot } from "./bot";
import { InMemoryConversationStorage } from "./services/InMemoryConversationStorage";

const ENV_FILE = path.join(__dirname, "..", ".env");
config({ path: ENV_FILE });

const DEV_ENVIRONMENT = "development";
const BOT_CONFIGURATION = (process.env.NODE_ENV || DEV_ENVIRONMENT);
const BOT_FILE = path.join(__dirname, "..", (process.env.botFilePath || ""));

// Create HTTP server.
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`\n${server.name} listening to ${server.url}`);
    console.log(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator`);
    console.log(`\nTo talk to your bot, open proactiveBot.bot file in the Emulator.`);
});

// Read bot configuration from .bot file.
let botConfig;
try {
    botConfig = BotConfiguration.loadSync(BOT_FILE, process.env.botFileSecret);
} catch (err) {
    console.error(`\nError reading bot file. Please ensure you have valid botFilePath and botFileSecret set for your environment.`);
    console.error(`\n - The botFileSecret is available under appsettings for your Azure Bot Service bot.`);
    console.error(`\n - If you are running this bot locally, consider adding a .env file with botFilePath and botFileSecret.`);
    console.error(`\n - See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.\n\n`);
    process.exit();
}

// Get bot endpoint configuration by service name
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION) as IEndpointService;

// Create adapter.
const adapter = new BotFrameworkAdapter({
    appId: endpointConfig.appId || process.env.microsoftAppID,
    appPassword: endpointConfig.appPassword || process.env.microsoftAppPassword,
});

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    console.error(`\n [onTurnError]: ${ error }`);
    // Send a message to the user
    await context.sendActivity(`Oops. Something went wrong!`);
};

// Create the main dialog.
const conversationStorage = new InMemoryConversationStorage();
const myBot = new ProactiveBot(conversationStorage);

// Listen for incoming requests.
server.post("/api/messages", (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        // Route to main dialog.
        await myBot.onTurn(context);
    });
});
