export function trimAll(str: string): string {
    return str.replace( /\s\s+/g, ' ').trim();
}