import {Group} from "../xls";
import {LessonScheduleParser} from "../lesson-schedule-parser";

export interface SocialMediaBotInterface {
    getName(): string;

    initialize(lesson_schedule_parser: LessonScheduleParser): void;

    start(): Promise<void>;

    stop(): void;

    handleScheduleUpdate(cachedGroup: Group, group: Group, affectedDays: Array<number>): Promise<void>;

    // next_lesson_idx не может быть null, т.к., если lesson_idx была последней, то
    handleLessonEnd(group: Group, day_idx: number, lesson_idx: number, next_lesson_idx: number): Promise<void>;

    handleDayEnd(group: Group, day_idx: number): Promise<void>;

    handleSignal(signal: string): void;
}