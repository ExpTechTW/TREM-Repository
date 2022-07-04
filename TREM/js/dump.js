const fs = require("node:fs");

if (!fs.existsSync(`${localStorage["config"]}/Log`))
	fs.mkdirSync(`${localStorage["config"]}/Log`);

if (!fs.existsSync(`${localStorage["config"]}/Log/TREM.log`))
	fs.writeFileSync(`${localStorage["config"]}/Log/TREM.log`, "", "utf8");

const path = `${localStorage["config"]}/Log/TREM.log`;

/**
 * Dump a message.
 * @param {DumpData} dumpData
 * @typedef {object} DumpData
 * @property {0|1|2|3} level 0: info, 1: warn, 2: error, 3: debug
 * @property {string} message Dump message.
 * @property {string} origin Dump origin.
 */
function dump(dumpData) {
	const now = new Date();
	const nowTime = (new Date(now.getTime() - (now.getTimezoneOffset() * 60000))).toISOString().slice(0, -1);
	const line = `[${nowTime}] ${dumpData.origin} >> ${dumpData.message}`;
	console[["log", "warn", "error", "debug"][dumpData.level]](line);
	fs.appendFileSync(path, line + "\r\n", "utf8");
}

function dumpUpload() {
	const msg = {
		"APIkey"        : "https://github.com/ExpTechTW",
		"Function"      : "data",
		"Type"          : "TREM-Dump",
		"FormatVersion" : 1,
		"Value"         : fs.readFileSync(path).toString(),
		"UUID"          : localStorage["UUID"],
	};
	axios.post("https://exptech.mywire.org:1015", msg)
		.then((response) => {
			if (response.data.response == "Speed limit")
				alert("Dump 發送限制\n稍等 5 分鐘後再次嘗試");
			else {
				alert("Dump 發送成功");
				fs.writeFileSync(`${localStorage["dirname"]}/Log/TREM.log`, "", "utf8");
			}
		})
		.catch((error) => {
			alert("Dump 發送失敗\nError > " + error);
		});
}