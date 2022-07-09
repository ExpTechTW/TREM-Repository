const $ = require("jquery");
const { app } = require("@electron/remote");
const fs = require("node:fs");
const { join } = require("node:path");

const CONFIG_PATH = join(app.getPath("userData"), "config");
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH));