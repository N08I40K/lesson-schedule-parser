import {XlsDownloaderBase, XlsDownloaderCacheMode, XlsDownloaderResult} from "./site-downloader.base";

import * as XLSX from "xlsx";
import {trimAll} from "./string.util";
import {Day, Group, Lesson} from "./xls";

type InternalId = { r: number, c: number, name: string };
type InternalDay = InternalId & { lessons: Array<InternalId> };

export type GroupScheduleUpdateHandler = (cachedGroup: Group, group: Group, affectedDays: Array<number>) => Promise<void>;

export class LessonScheduleParser {
    private lastResult: Group | null = null;
    private handlers: Array<GroupScheduleUpdateHandler> = [];
    private interval: NodeJS.Timeout = null;

    public constructor(private xls_downloader: XlsDownloaderBase, private whitelisted_group: string) {
        this.getLessonSchedule(true).then();
    }

    public getXLSDownloader(): XlsDownloaderBase {
        return this.xls_downloader;
    }

    private getCellName(worksheet: XLSX.Sheet, row: number, column: number): any | null {
        const cell = worksheet[XLSX.utils.encode_cell({r: row, c: column})];
        return cell ? cell.v : null;
    }

    private parseTeacherFullNames(lesson_name: string): { lessonName: string, teacherFullNames: Array<string> } {
        const firstRegex = /(?:[А-ЯЁ][а-яё]+\s[А-ЯЁ]\.[А-ЯЁ]\.(?:\s\([0-9] подгруппа\))?(?:,\s)?)+$/gm;
        const secondRegex = /(?:[А-ЯЁ][а-яё]+\s[А-ЯЁ]\.[А-ЯЁ]\.(?:\s\([0-9] подгруппа\))?)+/gm;

        const fm = firstRegex.exec(lesson_name);
        if (fm === null)
            return {lessonName: lesson_name, teacherFullNames: []};

        let teacherFullNames: Array<string> = [];

        let teacherFullNameMatch: RegExpExecArray;
        while ((teacherFullNameMatch = secondRegex.exec(fm[0])) !== null) {
            if (teacherFullNameMatch.index === secondRegex.lastIndex)
                secondRegex.lastIndex++;

            teacherFullNames.push(teacherFullNameMatch[0].trim());
        }

        if (teacherFullNames.length === 0)
            return {lessonName: lesson_name, teacherFullNames: []};

        return {
            lessonName: lesson_name.substring(0, fm.index).trim(),
            teacherFullNames: teacherFullNames
        };
    }

    parseSkeleton(worksheet: XLSX.Sheet): { group_skeleton: InternalId, day_skeletons: Array<InternalDay> } {
        const range = XLSX.utils.decode_range(worksheet["!ref"] || "");
        let header_parsed: boolean = false;

        let group: InternalId = null;
        let days: Array<InternalDay> = []

        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const day_name = this.getCellName(worksheet, R, 0);
            if (!day_name)
                continue;

            if (!header_parsed) {
                header_parsed = true;

                --R;
                for (let C = range.s.c + 2; C <= range.e.c; ++C) {
                    const group_name = this.getCellName(worksheet, R, C);
                    if (!group_name || this.whitelisted_group !== group_name)
                        continue;

                    group = {r: R, c: C, name: group_name};
                    break;
                }
                ++R;
            }

            days.push({r: R, c: 0, name: day_name, lessons: []});

            if (days.length > 2 && days[days.length - 2].name.startsWith("Суббота"))
                break;
        }

        return {day_skeletons: days, group_skeleton: group};
    }

    async getLessonSchedule(force_cached: boolean = false): Promise<Group | null> {
        let download_data: XlsDownloaderResult;

        if (!force_cached || (download_data = await this.xls_downloader.getCachedXLS()) === null) {
            download_data = await this.xls_downloader.downloadXLS();

            if (!download_data.new && this.lastResult && this.xls_downloader.getCacheMode() != XlsDownloaderCacheMode.NONE)
                return this.lastResult;
        }

        const work_book = XLSX.read(download_data.fileData);
        const worksheet = work_book.Sheets[work_book.SheetNames[0]];

        const {group_skeleton, day_skeletons} = this.parseSkeleton(worksheet);

        let group: Group = {name: group_skeleton.name, days: []};

        for (let day_idx = 0; day_idx < day_skeletons.length - 1; ++day_idx) {
            let day_skeleton = day_skeletons[day_idx];
            let day = new Day(day_skeleton.name, []);

            const lesson_time_C = day_skeletons[0].c + 1;
            const R_distance = day_skeletons[day_idx + 1].r - day_skeleton.r;

            for (let R = day_skeleton.r; R < day_skeleton.r + R_distance; ++R) {
                let lesson_time = this.getCellName(worksheet, R, lesson_time_C);
                if (!lesson_time || typeof lesson_time !== "string")
                    continue;

                const lesson_name = this.getCellName(worksheet, R, group_skeleton.c);
                let lesson_cabinets: Array<string> = [];

                const raw_lesson_cabinets = String(this.getCellName(worksheet, R, group_skeleton.c + 1));
                if (raw_lesson_cabinets !== 'null') {
                    const raw_lesson_cabinet_parts = raw_lesson_cabinets.split(/(\n|\s)/g);

                    for (const cabinet of raw_lesson_cabinet_parts) {
                        if (cabinet.length === 0 || cabinet === ' ' || cabinet === '\n')
                            continue;

                        lesson_cabinets.push(cabinet);
                    }
                }

                const normal: boolean = lesson_time?.includes(" пара ");
                const parse_result = this.parseTeacherFullNames(trimAll(lesson_name?.replace("\n", "") ?? ""));

                const result_lesson = new Lesson(
                    (normal ? lesson_time.substring(6) : lesson_time).trim(),
                    normal,
                    parse_result.lessonName,
                    lesson_cabinets,
                    parse_result.teacherFullNames
                );

                day.lessons.push(result_lesson);
            }

            group.days.push(day);
        }

        await this.checkGroupScheduleUpdate(this.lastResult, group);

        return (this.lastResult = group);
    }

    public getLastResult(): Group | null {
        return this.lastResult;
    }

    public on(handler: GroupScheduleUpdateHandler): void {
        this.handlers.push(handler);
    }

    public start(): void {
        this.stop();

        this.interval = setInterval(async () => {
            console.log(`\[${new Date()}\] Попытка парсинга расписания...`);
            await this.getLessonSchedule();
            console.log(`\[${new Date()}\] Попытка парсинга расписания завершена успешно!`);
        }, 5 * 60 * 1000);

        console.log("Авто-парсинг запущен!");
    }

    public stop(): void {
        if (!this.interval)
            return;

        clearInterval(this.interval);
        this.interval = null;
    }

    private async checkGroupScheduleUpdate(cachedGroup: Group | null, group: Group): Promise<void> {
        if (cachedGroup === null)
            return;

        this.stop();

        const affectedDays: Array<number> = [];

        for (const day_idx in group.days) {
            // noinspection SpellCheckingInspection
            const lday = group.days[day_idx];
            // noinspection SpellCheckingInspection
            const rday = cachedGroup.days[day_idx];

            if (!lday.equals(rday))
                affectedDays.push(Number.parseInt(day_idx));
        }

        for (const handler of this.handlers)
            await handler(cachedGroup, group, affectedDays);
    }
}