import {LessonScheduleParser} from "./lesson-schedule-parser";
import {XlsDownloaderImpl} from "./xls-downloader/xls-downloader.impl";
import {getConfiguration, loadConfiguration} from "./configuration";
import * as fs from "node:fs";
import {SocialMediaBotInterface} from "./bot/social-media-bot.interface";
import {TelegramBotImpl} from "./bot/telegram-bot.impl";
import {telegramConstants} from "./constants";
import {ScheduleDayWatcher} from "./schedule-day-watcher";
import {Group} from "./xls";


try {
    fs.accessSync("./data/", fs.constants.R_OK);
} catch (err) {
    fs.mkdirSync("./data/")
}

loadConfiguration();
const configuration = getConfiguration();
let group: Group | null = null;

const scheduleParser = new LessonScheduleParser(
    new XlsDownloaderImpl(configuration.mainUrl, configuration.cacheMode),
    configuration.group);

const scheduleDayWatcher = new ScheduleDayWatcher();

const socialMediaBots: Array<SocialMediaBotInterface> = [
    new TelegramBotImpl(telegramConstants.BOT_TOKEN)
];

scheduleParser.on(async (cachedGroup, _group, affectedDays) => {
    group = _group;

    for (const socialMediaBot of socialMediaBots)
        await socialMediaBot.handleScheduleUpdate(cachedGroup, group, affectedDays);

    scheduleDayWatcher.handleScheduleUpdate(group);
});

scheduleDayWatcher.on("day_end", async (group, dayIdx) => {
    for (const socialMediaBot of socialMediaBots)
        await socialMediaBot.handleDayEnd(group, dayIdx);
});

scheduleDayWatcher.on("lesson_end", async (group, dayIdx, lessonIdx) => {
    const day = group.days[new Date().getDay() - 1];
    const next_lesson_idx = day.used_lesson_idxes.indexOf(lessonIdx);

    for (const socialMediaBot of socialMediaBots)
        await socialMediaBot.handleLessonEnd(group, dayIdx, lessonIdx, next_lesson_idx);
});

for (const socialMediaBot of socialMediaBots) {
    socialMediaBot.initialize(scheduleParser);
    socialMediaBot.start().then(() => {
        console.log(`Бот ${socialMediaBot.getName()} выключен!`);
    });
}

scheduleParser.start();