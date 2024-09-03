export type XlsDownloaderResult = { fileData: ArrayBuffer, updateDate: string, etag: string, new: boolean };

export enum XlsDownloaderCacheMode {
    NONE = 0,
    SOFT, // читать кеш только если был изменён etag.
    HARD // читать кеш всегда, кроме случаев его отсутствия
}

export abstract class XlsDownloaderBase {
    public constructor(protected url: string,
                       protected cache_mode: XlsDownloaderCacheMode = XlsDownloaderCacheMode.NONE) {
    };

    abstract downloadXLS(): Promise<XlsDownloaderResult>;

    abstract getCachedXLS(): Promise<XlsDownloaderResult | null>;

    abstract getLastETag(): string | null;
}