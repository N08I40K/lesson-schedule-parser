import {Day, Group, LessonType} from "../xls";
import {SocialMediaBotInterface} from "./social-media-bot.interface";
import {Context, Telegraf} from "telegraf";
import {getConfiguration} from "../configuration";
import {LessonScheduleParser} from "../lesson-schedule-parser";
import {Update} from "telegraf/typings/core/types/typegram";
import {customLessonIdxToText, defaultLessonIdxToText} from "../string.util";

export class TelegramBotImpl implements SocialMediaBotInterface {
    bot: Telegraf = null;
    lesson_schedule_parser: LessonScheduleParser = null;

    constructor(private readonly token: string) {
    }

    private rebindCallApi(telegram: typeof this.bot.telegram): void {
        const oldCallApi = telegram.callApi.bind(telegram);
        const newCallApi: typeof telegram.callApi =
            async function newCallApi(this: typeof telegram,
                                      method,
                                      payload,
                                      {signal} = {}) {

                if (method === "sendMessage")
                    return oldCallApi(method, {...payload, parse_mode: 'Markdown'}, {signal})

                return oldCallApi(method, payload, {signal});
            };

        telegram.callApi = newCallApi.bind(telegram);
    }

    private getDay(day_offset: number = 0, day_description: string = "сегодня"): string {
        const day = (new Date().getDay() - 1 + day_offset) % 7;

        const cachedGroup = this.lesson_schedule_parser.getLastResult()!;

        return `Расписание для группы ${cachedGroup!.name} на ${day_description}!\n
${cachedGroup!.days[day].toString()}`;
    }

    getName(): string {
        return "Telegram";
    }

    initialize(lesson_schedule_parser: LessonScheduleParser): void {
        this.lesson_schedule_parser = lesson_schedule_parser;

        this.bot = new Telegraf(this.token);

        // Авто-использование markdown при отправке сообщений.
        this.rebindCallApi(this.bot.telegram);

        this.bot.use(async (ctx, next) => {
            // так можно?
            this.rebindCallApi(ctx.telegram);
            await next();
        })

        this.bot.command("today", async (ctx: Context<Update>) => {
            await ctx.reply(this.getDay());
        });

        this.bot.command("tomorrow", async (ctx: Context<Update>) => {
            await ctx.reply(this.getDay(1, "завтра"));
        });
    }

    async start(): Promise<void> {
        return this.bot.launch();
    }

    stop(): void {
        this.bot.stop();
    }

    async handleScheduleUpdate(_cachedGroup: Group, group: Group, affectedDays: Array<number>): Promise<void> {
        const subscribers = getConfiguration().socialMedia.telegram.subscribers;

        const announce_text = `Обновлено распиcание для группы ${group.name}!`;
        for (const subscriber of subscribers)
            await this.bot.telegram.sendMessage(subscriber, announce_text);

        for (const day_idx of affectedDays) {
            const day_text: string = group.days[day_idx].toString();

            for (const subscriber of subscribers)
                await this.bot.telegram.sendMessage(subscriber, day_text);
        }
    }

    // TODO: Срочно придумать как исправить этот пиздец.
    private static getLessonType(day: Day, lessonIdx: number, isDefault: boolean): string {
        const internal_idx = day.getLessonIdx(lessonIdx);

        if (isDefault)
            return `${defaultLessonIdxToText(day.default_lesson_idxes.indexOf(internal_idx))} пара`;
        return `${customLessonIdxToText(day.custom_lesson_idxes.indexOf(internal_idx))} доп. занятие`;

    }

    async handleLessonEnd(group: Group, dayIdx: number, lessonIdx: number, nextLessonIdx: number): Promise<void> {
        const day = group.days[dayIdx];
        const is_default = day.lessons[lessonIdx].type === LessonType.DEFAULT;

        const announce_text = `${TelegramBotImpl.getLessonType(day, lessonIdx, is_default)} группы ${group.name} окончен${"оа"[+is_default]}!`;
        const next_text = `Далее следует...\n\n${day.getLesson(nextLessonIdx).toString()}`;

        for (const subscriber of getConfiguration().socialMedia.telegram.subscribers) {
            await this.bot.telegram.sendMessage(subscriber, announce_text);
            await this.bot.telegram.sendMessage(subscriber, next_text);
        }
    }

    async handleDayEnd(group: Group, _day_idx: number): Promise<void> {
        const subscribers = getConfiguration().socialMedia.telegram.subscribers;

        const announce_text = `Все пары группы ${group.name} на сегодня окончены!`;
        for (const subscriber of subscribers)
            await this.bot.telegram.sendMessage(subscriber, announce_text);
    }

    handleSignal(signal: string): void {
        try {
            this.bot.telegram.sendMessage(
                getConfiguration().socialMedia.telegram.admin,
                `Бот умер! ${signal}`).then();
        } catch (error) {
            console.error("Токен кривой либо нет сети!");
        }

        this.bot.stop(signal);
    }
}