export class Lesson {
    constructor(public readonly time: string,
                public readonly normal: boolean,
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
        return `| Кабинет${this.cabinets.length > 1 ? "ы" : ""} — ${this.cabinets.join(", ")}`;
    }

    public toString(lesson_idx: number | null = null): string {
        if ((lesson_idx === null) !== (!this.normal))
            throw new Error("Некоректно передан номер пары!");

        if (lesson_idx) {
            return `${lesson_idx}. ${this.name} (${this.time}).
${this.toStringTeacherNames()}
${this.toStringCabinets()}`;
        } else
            return `${this.name} (${this.time})`;
    }
}

export class Day {
    constructor(public readonly name: string,
                public readonly lessons: Array<Lesson>) {
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
                    || llesson.time !== rlesson.time
                    || llesson.cabinets.toString() !== rlesson.cabinets.toString()
                    || llesson.teacherNames.toString() !== rlesson.teacherNames.toString()
                ))
                return false;
        }

        return true;
    }

    public getLessonsCount(day: Day): number {
        let result: number = 0;

        for (const lesson of day.lessons) {
            if (lesson.name.length > 0)
                ++result;
        }

        return result;
    }

    public toString(): string {
        if (this.getLessonsCount(this) == 0)
            return `${this.name}\n
Расписание ещё не обновилось :(`.trimEnd();

        let additional_lessons: number = 0;
        let normal_lessons: number = 0;
        let full_normal_lessons: number = 0;

        let lesson_description: string = "";

        for (const lesson of this.lessons) {
            if (lesson.normal)
                ++normal_lessons;
            else
                ++additional_lessons;

            if (lesson.name.length === 0)
                continue;

            if (lesson.normal)
                ++full_normal_lessons;

            lesson_description += `${lesson.toString(lesson.normal ? full_normal_lessons : null)}\n\n`;
        }

        return `${this.name}\n
Полных пар — ${full_normal_lessons}
Доп. приколов — ${additional_lessons}\n
${lesson_description}`.trimEnd();
    }
}

export type Group = {
    name: string,
    days: Array<Day>
};