import * as fs from "node:fs";
import {Expose, plainToInstance} from "class-transformer";
import {XlsDownloaderCacheMode} from "./xls-downloader/xls-downloader.base";

export class TelegramConfiguration {
    @Expose()
    public subscribers: Array<number> = [996004735];

    @Expose()
    public admin: number = 996004735;
}

export class SocialMediaConfiguration {
    @Expose()
    public telegram: TelegramConfiguration = new TelegramConfiguration();
}

export class Configuration {
    @Expose()
    public group: string = "ИС-214/23";

    @Expose()
    public mainUrl: string = "https://politehnikum-eng.ru/index/raspisanie_zanjatij/0-409";

    @Expose()
    public cacheMode: XlsDownloaderCacheMode = XlsDownloaderCacheMode.SOFT;

    @Expose()
    public socialMedia: SocialMediaConfiguration = new SocialMediaConfiguration();
}

let configuration = new Configuration();

export function saveConfiguration(): void {
    fs.writeFileSync("./data/configuration.json", JSON.stringify(configuration, null, 4));
}

export function loadConfiguration(): void {
    try {
        fs.accessSync("./data/configuration.json", fs.constants.R_OK);
    } catch (error) {
        saveConfiguration();
    }

    try {
        const buffer = fs.readFileSync("./data/configuration.json");

        configuration = plainToInstance(Configuration, JSON.parse(buffer.toString()), {
            excludeExtraneousValues: true,
            exposeUnsetFields: false
        });
    } catch (error) {}

    saveConfiguration();
}

export function getConfiguration(): Configuration {
    return configuration;
}