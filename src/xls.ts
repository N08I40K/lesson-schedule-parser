export class LessonTime {
    public readonly startMinutes: number;
    public readonly endMinutes: number;
    public readonly duration: number;

    constructor(time: string) {
        time = time.replaceAll(".", ":");

        const regex = /(\d+:\d+)-(\d+:\d+)/g;

        let parse_result = regex.exec(time);
        if (!parse_result) {
            this.startMinutes = 0;
            this.endMinutes = 0;
            this.duration = 0;

            return;
        }

        const start_str = parse_result[1].split(":");
        const end_str = parse_result[2].split(":");

        this.startMinutes = (Number.parseInt(start_str[0]) * 60) + Number.parseInt(start_str[1]);
        this.endMinutes = (Number.parseInt(end_str[0]) * 60) + Number.parseInt(end_str[1]);
        this.duration = this.endMinutes - this.startMinutes;
    }

    // Иногда мне кажется, что я делаю что-то неправильно

    private static toStringNumber(num: number): string {
        return "0".repeat(+(num <= 9)) + num;
    }

    public static toStringMinutes(minutes: number): string {
        return `${LessonTime.toStringNumber(Math.floor(minutes / 60))}:${LessonTime.toStringNumber(minutes % 60)}`;
    }

    public toString(): string {
        return `с ${LessonTime.toStringMinutes(this.startMinutes)} до ${LessonTime.toStringMinutes(this.endMinutes)}`;
    }
}

export enum LessonType {
    DEFAULT,
    CUSTOM,
    // Не должны использоваться в качестве типа пары.
    USED,
    INTERNAL
}

export class Lesson {
    constructor(public readonly time: LessonTime,
                public readonly type: LessonType,
                public readonly name: string | null,
                public readonly cabinets: Array<string>,
                public readonly teacherNames: Array<string>) {
    }

    private toStringTeacherNames(): string {
        if (this.teacherNames.length == 1)
            return `| Преподаватель:\n|— ${this.teacherNames[0]}`;

        return `| Преподаватели:\n|— ${this.teacherNames.join("\n|— ")}`;
    }

    private toStringCabinets(): string {
        if (this.cabinets.length == 1)
            return `| Кабинет:\n|— ${this.cabinets[0]}`;

        return `| Кабинеты:\n|— ${this.cabinets.join(", ")}`;
    }

    public toString(): string {
        if (this.type === LessonType.DEFAULT) {
            return `${this.name} (${this.time}).
${this.toStringTeacherNames()}
${this.toStringCabinets()}`;
        } else
            return `${this.name} (${this.time})`;
    }
}

export class Day {
    public readonly used_lesson_idxes: Array<number> = [];

    public readonly default_lesson_idxes: Array<number> = [];
    public readonly custom_lesson_idxes: Array<number> = [];

    constructor(public readonly name: string,
                public readonly lessons: Array<Lesson>) {
    }

    public recalculateLessons(): void {
        for (const lesson_str_idx in this.lessons) {
            const lesson_idx = Number.parseInt(lesson_str_idx);

            const lesson = this.lessons[lesson_idx];
            if (!lesson.name.length)
                continue;

            this.used_lesson_idxes.push(lesson_idx);

            (lesson.type === LessonType.DEFAULT
                ? this.default_lesson_idxes
                : this.custom_lesson_idxes).push(lesson_idx);
        }
    }

    // ну это вообще пиздец
    public getLesson(idx: number, type: LessonType = LessonType.USED): Lesson {
        let lesson_idx: number;

        switch (type) {
            case LessonType.DEFAULT: {
                lesson_idx = this.default_lesson_idxes[idx]
                break;
            }
            case LessonType.CUSTOM: {
                lesson_idx = this.custom_lesson_idxes[idx]
                break;
            }
            case LessonType.USED: {
                lesson_idx = this.used_lesson_idxes[idx]
                break;
            }
            case LessonType.INTERNAL: {
                lesson_idx = idx;
                break;
            }
            default:
                throw new Error("Неизвестный тип пары!");
        }

        return this.lessons[lesson_idx];
    }

    public getLessonIdx(idx: number, type: LessonType = LessonType.USED): number {
        switch (type) {
            case LessonType.DEFAULT: {
                return this.default_lesson_idxes[idx];
            }
            case LessonType.CUSTOM: {
                return this.custom_lesson_idxes[idx]
            }
            case LessonType.USED: {
                return this.used_lesson_idxes[idx]
            }
            default:
                throw new Error("Неизвестный тип пары!");
        }
    }

    public equals(day: Day): boolean {
        if (day === undefined || day.lessons.length != this.lessons.length)
            return false;

        for (const lesson_idx in this.lessons) {
            // noinspection SpellCheckingInspection
            const llesson = this.lessons[lesson_idx];
            // noinspection SpellCheckingInspection
            const rlesson = day.lessons[lesson_idx];
            if (llesson.name.length > 0 &&
                (
                    llesson.name !== rlesson.name
                    || llesson.time.startMinutes !== rlesson.time.startMinutes
                    || llesson.time.endMinutes !== rlesson.time.endMinutes
                    || llesson.cabinets.toString() !== rlesson.cabinets.toString()
                    || llesson.teacherNames.toString() !== rlesson.teacherNames.toString()
                ))
                return false;
        }

        return true;
    }

    public toString(): string {
        if (!this.used_lesson_idxes.length)
            return `${this.name}\n
Расписание ещё не обновилось :(`.trimEnd();

        let additional_lessons: number = 0;
        let normal_lessons: number = 0;
        let full_normal_lessons: number = 0;

        let lesson_description: string = "";

        for (const lesson of this.lessons) {
            const is_default = lesson.type === LessonType.DEFAULT;

            if (is_default)
                ++normal_lessons;
            else
                ++additional_lessons;

            if (lesson.name.length === 0)
                continue;

            if (is_default)
                ++full_normal_lessons;

            lesson_description += `${is_default ? full_normal_lessons + ". " : ""}${lesson}\n\n`;
        }

        const start_time = this.getLesson(0).time.startMinutes;
        const end_time = this.getLesson(this.used_lesson_idxes.length - 1).time.endMinutes;

        const duration = end_time - start_time;
        const duration_str = `${Math.floor(duration / 60)}ч. ${duration % 60}мин.`;

        return `${this.name}\n
Пар — ${full_normal_lessons} (+ ${additional_lessons} доп. занятий)
С ${LessonTime.toStringMinutes(start_time)} до ${LessonTime.toStringMinutes(end_time)} (${duration_str})\n
${lesson_description}`.trimEnd();
    }
}

export type Group = {
    name: string,
    days: Array<Day>
};