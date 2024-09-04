import {Group} from "../xls";
import {LessonScheduleParser} from "../lesson-schedule-parser";

export interface SocialMediaBotInterface {
    getName(): string;

    initialize(lesson_schedule_parser: LessonScheduleParser): void;

    start(): Promise<void>;

    stop(): void;

    handleGroupScheduleUpdate(cachedGroup: Group, group: Group, affectedDays: Array<number>): Promise<void>;

    handleSignal(signal: string): void;
}