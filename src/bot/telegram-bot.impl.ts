import {Group} from "src/xls";
import {SocialMediaBotInterface} from "./social-media-bot.interface";
import {Context, Telegraf} from "telegraf";
import {getConfiguration} from "../configuration";
import {LessonScheduleParser} from "../lesson-schedule-parser";
import {Update} from "telegraf/typings/core/types/typegram";

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

    async handleGroupScheduleUpdate(_cachedGroup: Group, group: Group, affectedDays: Array<number>): Promise<void> {
        const subscribers = getConfiguration().socialMedia.telegram.subscribers;

        for (const subscriber of subscribers)
            await this.bot.telegram.sendMessage(subscriber, `Обновлено распиcание для группы ${group.name}!`);

        for (const day_idx of affectedDays) {
            const serialized_day: string = group.days[day_idx].toString();

            for (const subscriber of subscribers)
                await this.bot.telegram.sendMessage(subscriber, serialized_day);
        }
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