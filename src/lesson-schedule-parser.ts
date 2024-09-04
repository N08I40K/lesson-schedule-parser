import {XlsDownloaderBase, XlsDownloaderResult} from "./site-downloader.base";

import * as XLSX from "xlsx";
import {trimAll} from "./string.util";

type InternalId = { r: number, c: number, name: string };
type InternalDay = InternalId & { lessons: Array<InternalId> };

export type Lesson = {
    time: string,
    normal: boolean,
    name: string | null,
    cabinets: Array<number>,
    teacherNames: Array<string>
};
export type Day = {
    name: string,
    lessons: Array<Lesson>
};
export type Group = {
    name: string,
    days: Array<Day>
};

export class LessonScheduleParser {
    constructor(private xls_downloader: XlsDownloaderBase, private whitelisted_groups: string[]) {
    }

    public getXLSDownloader(): XlsDownloaderBase {
        return this.xls_downloader;
    }

    private getCellName(worksheet: XLSX.Sheet, row: number, column: number): any | null {
        const cell = worksheet[XLSX.utils.encode_cell({r: row, c: column})];
        return cell ? cell.v : null;
    }

    private parseTeacherFullNames(lesson_name: string): { lessonName: string, teacherFullNames: Array<string> } {
        const firstRegex = /(?:[А-ЯЁ][а-яё]+\s[А-ЯЁ]\.[А-ЯЁ]\.,?\s?)+$/gm;
        const secondRegex = /(?:[А-ЯЁ][а-яё]+\s[А-ЯЁ]\.[А-ЯЁ]\.)+/gm;

        const fm = firstRegex.exec(lesson_name);
        if (fm === null)
            return {lessonName: lesson_name, teacherFullNames: []};

        const sm = secondRegex.exec(fm[0])
        if (sm === null)
            return {lessonName: lesson_name, teacherFullNames: []};

        let teacherFullNames: Array<string> = [];
        for (let i = 0; i < sm!.length; i++)
            teacherFullNames.push(sm[i].trim());

        return {
            lessonName: lesson_name.substring(0, fm.index).trim(),
            teacherFullNames: teacherFullNames
        };
    }

    parseSkeleton(worksheet: XLSX.Sheet): { group_skeletons: Array<InternalId>, day_skeletons: Array<InternalDay> } {
        const range = XLSX.utils.decode_range(worksheet["!ref"] || "");
        let header_parsed: boolean = false;

        let groups: Array<InternalId> = []
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
                    if (!group_name || !this.whitelisted_groups.includes(group_name))
                        continue;

                    groups.push({r: R, c: C, name: group_name});
                }
                ++R;
            }

            days.push({r: R, c: 0, name: day_name, lessons: []});

            if (days.length > 2 && days[days.length - 2].name.startsWith("Суббота"))
                break;
        }

        return {day_skeletons: days, group_skeletons: groups};
    }

    async get_lesson_schedule(force_cached: boolean = false): Promise<Group[]> {
        let download_data: XlsDownloaderResult;

        if (force_cached) {
            download_data = await this.xls_downloader.getCachedXLS();
            if (!download_data) {
                return [];
            }
        } else {
            download_data = await this.xls_downloader.downloadXLS();
        }

        const work_book = XLSX.read(download_data.fileData);
        const worksheet = work_book.Sheets[work_book.SheetNames[0]];

        const {group_skeletons, day_skeletons} = this.parseSkeleton(worksheet);

        let groups: Array<Group> = [];

        for (const group_skeleton of group_skeletons) {
            let group: Group = {name: group_skeleton.name, days: []};

            for (let day_idx = 0; day_idx < day_skeletons.length - 1; ++day_idx) {
                let day_skeleton = day_skeletons[day_idx];
                let day: Day = {name: day_skeleton.name, lessons: []};

                const lesson_time_C = day_skeletons[0].c + 1;
                const R_distance = day_skeletons[day_idx + 1].r - day_skeleton.r;

                for (let R = day_skeleton.r; R < day_skeleton.r + R_distance; ++R) {
                    let lesson_time = this.getCellName(worksheet, R, lesson_time_C);
                    if (!lesson_time || typeof lesson_time !== "string")
                        continue;

                    const lesson_name = this.getCellName(worksheet, R, group_skeleton.c);
                    let lesson_cabinets: Array<number> = [];

                    const lesson_cabinets_data = this.getCellName(worksheet, R, group_skeleton.c + 1);
                    if (lesson_cabinets_data !== null) {
                        // noinspection SuspiciousTypeOfGuard
                        if (typeof lesson_cabinets_data === "number")
                            lesson_cabinets.push(lesson_cabinets_data);
                        else {
                            for (const cabinet of lesson_cabinets_data.split("\n"))
                                lesson_cabinets.push(Number.parseInt(cabinet));
                        }
                    }

                    const normal: boolean = lesson_time?.includes(" пара ");
                    const parse_result = this.parseTeacherFullNames(trimAll(lesson_name?.replace("\n", "") ?? ""));

                    const result_lesson: Lesson = {
                        time: (normal ? lesson_time.substring(6) : lesson_time).trim(),
                        normal: normal,
                        name: parse_result.lessonName,
                        cabinets: lesson_cabinets,
                        teacherNames: parse_result.teacherFullNames
                    };

                    day.lessons.push(result_lesson);
                }

                group.days.push(day);
            }
            groups.push(group);
        }

        return groups;
    }
}