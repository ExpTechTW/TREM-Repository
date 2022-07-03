if (!fs.existsSync(`${localStorage["config"]}/Log`))
	fs.mkdirSync(`${localStorage["config"]}/Log`);


if (!fs.existsSync(`${localStorage["config"]}/Log/TREM.log`))
	fs.writeFileSync(`${localStorage["config"]}/Log/TREM.log`, "", "utf8");


let Dump = fs.readFileSync(`${localStorage["config"]}/Log/TREM.log`).toString();

function dump(msg, type) {
	if (type == undefined) type = "Info";
	const now = new Date();
	const nowTime = (new Date(now.getTime() - (now.getTimezoneOffset() * 60000))).toISOString().slice(0, -1);
	const list = Dump.split("\n");
	if (list.length > 1000) Dump = "";
	Dump = `[${now}] ${type} >> ${msg}\n` + Dump;
	console.log(`[${now}] ${type} >> ${msg}`);
	fs.writeFileSync(`${localStorage["config"]}/Log/TREM.log`, Dump, "utf8");
}

function dumpUpload() {
	const msg = {
		"APIkey"        : "https://github.com/ExpTechTW",
		"Function"      : "data",
		"Type"          : "TREM-Dump",
		"FormatVersion" : 1,
		"Value"         : Dump,
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