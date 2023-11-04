import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const DISCORD_APP_ID = process.env.DISCORD_APP_ID;
export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const APP_NAME = 'picsy';
export const DATA_DIR = process.env.PICSY_ALTERNATE_DATA_DIRECTORY || join(homedir(), `.${APP_NAME}`);


if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR);
}
