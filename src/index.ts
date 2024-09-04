import {LessonScheduleParser} from "./lesson-schedule-parser";
import {XlsDownloaderImpl} from "./site-downloader.impl";
import {getConfiguration, loadConfiguration} from "./configuration";
import * as fs from "node:fs";
import {SocialMediaBotInterface} from "./bot/social-media-bot.interface";
import {TelegramBotImpl} from "./bot/telegram-bot.impl";
import {telegramConstants} from "./constants";


try {
    fs.accessSync("./data/", fs.constants.R_OK);
} catch (err) {
    fs.mkdirSync("./data/")
}

loadConfiguration();
const configuration = getConfiguration();

const scheduleParser = new LessonScheduleParser(
    new XlsDownloaderImpl(configuration.mainUrl, configuration.cacheMode),
    configuration.group);

const socialMediaBots: Array<SocialMediaBotInterface> = [];

socialMediaBots.push(new TelegramBotImpl(telegramConstants.BOT_TOKEN));

scheduleParser.on(async (cachedGroup, group, affectedDays) => {
    for (const socialMediaBot of socialMediaBots)
        await socialMediaBot.handleGroupScheduleUpdate(cachedGroup, group, affectedDays);
});

for (const socialMediaBot of socialMediaBots) {
    socialMediaBot.initialize(scheduleParser);
    socialMediaBot.start().then(() => {
        console.log(`Бот ${socialMediaBot.getName()} выключен!`);
    });
}
scheduleParser.start();