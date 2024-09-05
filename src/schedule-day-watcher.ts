import {Group} from "./xls";

export type ScheduleDayWatcherEvents =
    | "lesson_end"
    | "day_end";
export type ScheduleDayWatcherHandler = (group: Group, dayIdx: number, lessonIdx?: number) => Promise<void>;

export class ScheduleDayWatcher {
    private readonly handlers: Map<string, Array<ScheduleDayWatcherHandler>> =
        new Map<string, Array<ScheduleDayWatcherHandler>>();

    private interval: NodeJS.Timeout | null = null;

    private cachedGroup: Group | null = null;
    private watchedIdx: number | null = null;

    public handleScheduleUpdate(group: Group) {
        this.cachedGroup = group;

        this.watchedIdx = null;
        this.start();
    }

    public on(event: ScheduleDayWatcherEvents, handler: ScheduleDayWatcherHandler): void {
        if (!this.handlers.has(event))
            this.handlers.set(event, []);

        this.handlers.get(event).push(handler);
    }

    private async callHandlers(event: ScheduleDayWatcherEvents, day_idx: number, lesson_idx?: number) {
        for (const handler of this.handlers.get(event) ?? [])
            handler(this.cachedGroup, day_idx, lesson_idx);
    }

    public start(): void {
        this.stop();

        setInterval(async () => {
            if (!this.cachedGroup)
                return;

            const date = new Date();

            const day_idx = date.getDay() - 1;
            const day = this.cachedGroup.days[day_idx];

            if (this.watchedIdx < 0 && this.watchedIdx !== null) {
                // если итерация по текущему дню завершена.
                if (this.watchedIdx === -(day_idx + 1))
                    return;

                this.watchedIdx = null;
                console.debug("Начался новый день!");
            }

            let next_lesson_idx =
                this.watchedIdx === null
                    ? 0
                    : this.watchedIdx + 1;

            const now_minutes = (date.getHours() * 60) + date.getMinutes();

            for (; next_lesson_idx < day.used_lesson_idxes.length; ++next_lesson_idx) {
                const lesson = day.getLesson(next_lesson_idx);

                if (lesson.time.endMinutes > now_minutes)
                    return;

                if (Math.abs(lesson.time.endMinutes - now_minutes) <= 1) {
                    // не уведомлять о конце последней пары, а сразу о конце дня.
                    if (next_lesson_idx === day.used_lesson_idxes.length - 1)
                        break;

                    this.watchedIdx = next_lesson_idx;
                    await this.callHandlers("lesson_end", day_idx, this.watchedIdx);

                    return;
                }
            }

            // что бы бот не писал о том, что пары кончились, если он был перезапущен.
            if (this.watchedIdx !== null)
                await this.callHandlers("day_end", day_idx, null);

            this.watchedIdx = -(day_idx + 1);
        }, 30 * 1000);
    }

    public stop(): void {
        if (!this.interval)
            return;

        clearInterval(this.interval);
        this.interval = null;
    }
}