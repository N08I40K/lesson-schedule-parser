import * as fs from "node:fs";
import {IsArray, IsNumber, ValidateNested} from "class-validator";
import {plainToClass, Type} from "class-transformer";

export class Configuration {
    public allowed_users: Set<number> = new Set();
    public subscribers: Array<number> = [];
    public groups: Array<number> = [];

    @IsNumber()
    public admin: number = 996004735;
}

export function saveConfiguration(configuration: Configuration): void {
    fs.writeFileSync("./configuration.json", JSON.stringify(configuration));
}

export function loadConfiguration(): Configuration {
    try {
        fs.accessSync("./configuration.json", fs.constants.R_OK);
    } catch (error) {
        const configuration = new Configuration();
        saveConfiguration(configuration);

        return configuration;
    }

    try {
        const buffer = fs.readFileSync("./configuration.json");
        return plainToClass(Configuration, JSON.parse(buffer.toString()));
    } catch (error) {
        return new Configuration();
    }
}