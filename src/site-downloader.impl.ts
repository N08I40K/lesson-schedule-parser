import {XlsDownloaderBase, XlsDownloaderCacheMode, XlsDownloaderResult} from "./site-downloader.base";
import axios from "axios";
import {JSDOM} from "jsdom";
import * as fs from "node:fs";


export class XlsDownloaderImpl extends XlsDownloaderBase {
    private last_etag: string | null = null;

    private async getDOM(): Promise<JSDOM> {
        const response = await axios.get(this.url);

        if (response.status !== 200) {
            throw new Error(`Неудалось получить данные с основной страницы!
Статус код: ${response.status}
${response.statusText}`);
        }

        return new JSDOM(response.data, {
            url: this.url,
            contentType: "text/html"
        });
    }

    private parseData(dom: JSDOM): { downloadLink: string, updateDate: string } {
        const schedule_block = dom.window.document.getElementById("cont-i");
        if (schedule_block === null)
            throw new Error("Не удалось найти блок расписаний!");

        const schedules = schedule_block.getElementsByTagName("div");
        if (schedules === null || schedules.length === 0)
            throw new Error("Не удалось найти строку с расписанием!");

        const poltavskaya = schedules[0];
        const link = poltavskaya.getElementsByTagName("a")[0]!;

        const spans = poltavskaya.getElementsByTagName("span");
        const update_date = spans[3].textContent!.trimStart();

        return {
            downloadLink: link.href,
            updateDate: update_date
        };
    }

    private isCacheDirExists(): boolean {
        try {
            fs.accessSync("./data/caches/", fs.constants.R_OK);

            return true;
        } catch (err) {
            return false;
        }
    }

    private writeCache(result: XlsDownloaderResult): void {
        if (!this.isCacheDirExists())
            fs.mkdirSync("./data/caches/", {recursive: false});

        fs.writeFileSync("./data/caches/updateDate.txt", result.updateDate);
        fs.writeFileSync("./data/caches/etag.txt", result.etag);
        fs.writeFileSync("./data/caches/fileData.xls", new DataView(result.fileData));
    }

    private tryReadCache(): XlsDownloaderResult | null {
        if (!this.isCacheDirExists())
            return null;

        try {
            fs.accessSync("./data/caches/updateDate.txt", fs.constants.R_OK);
            fs.accessSync("./data/caches/etag.txt", fs.constants.R_OK);
            fs.accessSync("./data/caches/fileData.xls", fs.constants.R_OK);

            const update_date = fs.readFileSync("./data/caches/updateDate.txt").toString();
            const etag = fs.readFileSync("./data/caches/etag.txt").toString();
            const file_data = fs.readFileSync("./data/caches/fileData.xls");

            return {
                fileData: file_data,
                updateDate: update_date,
                etag: etag,
                new: this.cacheMode === XlsDownloaderCacheMode.HARD
            };
        } catch (err) {
            return null;
        }
    }

    public async getCachedXLS(): Promise<XlsDownloaderResult | null> {
        const xlsDownloaderResult = this.tryReadCache();

        if (xlsDownloaderResult)
            this.last_etag = xlsDownloaderResult.etag;

        return xlsDownloaderResult;
    }

    public async downloadXLS(): Promise<XlsDownloaderResult> {
        if (this.cacheMode === XlsDownloaderCacheMode.HARD) {
            const cached_result = this.tryReadCache();
            if (cached_result !== null) {
                this.last_etag = cached_result.etag;
                return cached_result;
            }
        }

        const dom = await this.getDOM();
        const parse_data = this.parseData(dom);

        const response = await axios.get(parse_data.downloadLink, {responseType: "arraybuffer"});
        if (response.status !== 200) {
            throw new Error(`Неудалось получить excel файл!
Статус код: ${response.status}
${response.statusText}`);
        }

        const result: XlsDownloaderResult = {
            fileData: response.data.buffer,
            updateDate: parse_data.updateDate,
            etag: response.headers["etag"],
            new: this.cacheMode === XlsDownloaderCacheMode.NONE
                ? true
                : (this.tryReadCache()?.etag) !== response.headers["etag"]
        };

        if (this.cacheMode !== XlsDownloaderCacheMode.NONE)
            this.writeCache(result);

        this.last_etag = result.etag;

        return result;
    }

    public getLastETag(): string | null {
        return this.last_etag;
    }
}