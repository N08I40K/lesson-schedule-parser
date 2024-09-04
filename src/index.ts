import {Context, Telegraf} from "telegraf";

import {Day, Group, LessonScheduleParser} from "./lesson-schedule-parser";
import {XlsDownloaderImpl} from "./site-downloader.impl";
import {XlsDownloaderCacheMode} from "./site-downloader.base";
import {telegramConstants} from "./constants";
import {Update} from "telegraf/typings/core/types/typegram";
import {loadConfiguration} from "./configuration";

// TODO: Добавить обработку нескольких групп в боте.
const bot = new Telegraf(telegramConstants.BOT_TOKEN);

const scheduleParser = new LessonScheduleParser(
    new XlsDownloaderImpl(
        "https://politehnikum-eng.ru/index/raspisanie_zanjatij/0-409",
        XlsDownloaderCacheMode.SOFT), ["ИС-214/23"]);
const configuration = loadConfiguration();
let cachedGroup: Group | null = null;

scheduleParser.get_lesson_schedule(true).then((groups: Array<Group>) => {
    if (groups.length === 0)
        return;

    cachedGroup = groups[0];
});

function getDayLessonsCount(day: Day): number {
    let result: number = 0;

    for (const lesson of day.lessons) {
        if (lesson.name.length > 0)
            ++result;
    }

    return result;
}

function serializeDay(day: Day): string {
    if (getDayLessonsCount(day) == 0)
        return `${day.name}\n
Расписание ещё не обновилось :(`.trimEnd();

    let additional_lessons: number = 0;
    let normal_lessons: number = 0;
    let full_normal_lessons: number = 0;

    let lesson_description: string = "";

    for (const lesson of day.lessons) {
        if (lesson.normal)
            ++normal_lessons;
        else
            ++additional_lessons;

        if (lesson.name.length === 0)
            continue;

        if (lesson.normal) {
            ++full_normal_lessons;

            lesson_description += `${normal_lessons}. ${lesson.name} (${lesson.time}).
| Преподавател${lesson.teacherNames.length > 1 ? "и" : "ь"} - ${lesson.teacherNames.join(", ")}
| Кабинет${lesson.cabinets.length > 1 ? "ы" : ""} - ${lesson.cabinets.join(", ")}\n\n`;
        } else
            lesson_description += `${lesson.name} (${lesson.time})\n`;
    }

    return `${day.name}\n
Пар - ${full_normal_lessons}
Дополнительно - ${additional_lessons}\n
${lesson_description}`.trimEnd();
}

async function sendChangeNotification(group: Group): Promise<void> {
    if (cachedGroup === null)
        return;

    for (const subscriber of configuration.subscribers)
        await bot.telegram.sendMessage(subscriber, `Обновлено распиcание для группы ${group.name}!`);

    for (const day_idx in group.days) {
        const lday = group.days[day_idx];
        const rday = cachedGroup.days[day_idx];

        if (rday === undefined || rday.lessons.length != lday.lessons.length) {
            const serialized_day: string = serializeDay(lday);
            for (const subscriber of configuration.subscribers)
                await bot.telegram.sendMessage(subscriber, serialized_day);

            continue;
        }

        for (const lesson_idx in lday.lessons) {
            const llesson = lday.lessons[lesson_idx];
            const rlesson = rday.lessons[lesson_idx];
            if (llesson.name.length > 0 &&
                (
                    llesson.name !== rlesson.name
                    || llesson.time !== rlesson.time
                    || llesson.cabinets.toString() !== rlesson.cabinets.toString()
                    || llesson.teacherNames.toString() !== rlesson.teacherNames.toString()
                )) {

                const serialized_day: string = serializeDay(lday);
                for (const subscriber of configuration.subscribers)
                    await bot.telegram.sendMessage(subscriber, serialized_day);

                break;
            }
        }
    }
}

async function sendDay(user_id: number, day: Day, is_today: boolean = true, is_tomorrow: boolean = false): Promise<void> {
    let message_text = `Расписание для группы ${cachedGroup!.name} на ${
        is_today
            ? "сегодня"
            : is_tomorrow
                ? "завтра"
                : "какой-то день"
    }!\n\n${serializeDay(day)}`;

    await bot.telegram.sendMessage(user_id, message_text);
}

async function refreshData() {
    const prev_etag = scheduleParser.getXLSDownloader().getLastETag();
    const updated_group = (await scheduleParser.get_lesson_schedule())[0];

    const current_etag = scheduleParser.getXLSDownloader().getLastETag();

    if (prev_etag != current_etag)
        await sendChangeNotification(updated_group);

    cachedGroup = updated_group;
}

setInterval(async (): Promise<void> => {
    console.log("Try refresh!");

    await refreshData();
}, 10 * 60 * 1000);

bot.command("today", async (ctx: Context<Update>) => {
    await refreshData();

    const now = new Date();
    await sendDay(ctx.message.chat.id, cachedGroup.days[now.getDay() - 1]);
});

bot.command("tomorrow", async (ctx: Context<Update>) => {
    await refreshData();

    const now = new Date();
    await sendDay(ctx.message.chat.id, cachedGroup.days[now.getDay() == 7 ? 0 : now.getDay()], false, true);
});

bot.launch().then(() => {
    console.log("Bot stopped!");
});

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))