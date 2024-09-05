export function trimAll(str: string): string {
    return str.replace(/\s\s+/g, ' ').trim();
}

const customLessonIdxToTextPresets = [
    "Первое",
    "Второе",
    "Третье",
    "Четвёртое",
    "Пятое",
    "Шестое",
    "Седьмое",
];

export function customLessonIdxToText(num: number): string {
    return customLessonIdxToTextPresets[num];
}

const defaultLessonIdxToTextPresets = [
    "Первая",
    "Вторая",
    "Третья",
    "Четвёртая",
    "Пятая",
    "Шестая",
    "Седьмая",
];

export function defaultLessonIdxToText(num: number): string {
    return defaultLessonIdxToTextPresets[num];
}