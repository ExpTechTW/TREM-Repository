/* eslint-disable prefer-const */
const { BrowserWindow, app, ipcMain, shell } = require("@electron/remote");
const {
	NOTIFICATION_RECEIVED,
	NOTIFICATION_SERVICE_ERROR,
	NOTIFICATION_SERVICE_STARTED,
	START_NOTIFICATION_SERVICE,
} = require("electron-fcm-push-receiver/src/constants");
const WebSocket = require("ws");
const { ipcRenderer } = require("electron");

// #region config
let Config = {
	"accept.eew.jp": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"shock.smoothing": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"auto.waveSpeed": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"earthquake.Real-time": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"GPU.disable": {
		"type"  : "CheckBox",
		"value" : false,
	},
	"Real-time.show": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"Real-time.cover": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"eew.show": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"eew.cover": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"eew.audio": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"report.audio": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"Real-time.audio": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"Real-time.station": {
		"type"  : "SelectBox",
		"value" : "6732340",
	},
	"report.cover": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"eew.Intensity": {
		"type"  : "SelectBox",
		"value" : "0",
	},
	"map.autoZoom": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"report.show": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"earthquake.siteEffect": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"shock.p": {
		"type"  : "CheckBox",
		"value" : true,
	},
	"webhook.url": {
		"type"  : "TextBox",
		"value" : "",
	},
	"webhook.body": {
		"type"  : "TextBox",
		"value" : JSON.stringify({
			"username"   : "TREM | 台灣實時地震監測",
			"avatar_url" : "https://raw.githubusercontent.com/ExpTechTW/API/%E4%B8%BB%E8%A6%81%E7%9A%84-(main)/image/Icon/ExpTech.png",
			"embeds"     : [
				{
					"author": {
						"name": "TREM | 台灣實時地震監測",
					},
					"title"       : "",
					"description" : "%Time% 左右發生顯著有感地震\n\n東經: %EastLongitude% 度\n北緯: %NorthLatitude% 度\n深度: %Depth% 公里\n規模: %Scale%\n\n發報單位: %Government%\n\n慎防強烈搖晃，就近避難 [趴下、掩護、穩住]",
					"color"       : 4629503,
					"image"       : {
						"url": "",
					},
				},
			],
		}),
	},
	"location.city": {
		"type"  : "SelectBox",
		"value" : "臺南市",
	},
	"location.town": {
		"type"  : "SelectBox",
		"value" : "歸仁區",
	},
	"theme.color": {
		"type"  : "ColorBox",
		"value" : "#6750A4",
	},
	"theme.dark": {
		"type"  : "CheckBox",
		"value" : true,
	},
};
// #endregion

// #region 變數
let t = null;
let Lat = 25.0421407;
let Long = 121.5198716;
let audioList = [];
let audioLock = false;
let ReportCache = {};
let ReportMarkID = null;
let MarkList = [];
let EarthquakeList = {};
let marker = null;
let map;
let map1;
let Station = {};
let PGA = {};
let Pga = {};
let pga = {};
let PGALimit = 0;
let PGAaudio = false;
let PGAAudio = false;
let PGAtag = 0;
let MAXPGA = { pga: 0, station: "NA", level: 0 };
let TimerDesynced = false;
let expected = [];
let Info = {};
let Focus = [];
let PGAmark = false;
let ServerT = 0;
let ServerTime = 0;
let Check = {};
let NOW = new Date();
let ws;
let Reconnect = false;
let INFO = [];
let TINFO = 0;
let ITimer = null;
let Tsunami = {};
let Report = 0;
let Sspeed = 4;
let Pspeed = 7;
let Server = [];
let PAlert = {};
let Location;
let station = {};
let PGAjson = {};
let MainClock = null;
let _eewTest = false;
// #endregion

// #region override Date.format()
Date.prototype.format =
	/**
	 * Format DateTime into string with provided formatting string.
	 * @param {string} format The formatting string to use.
	 * @returns {string} The formatted string.
	 */
	function(format) {
		/**
		 * @type {Date}
		 */
		let me = this;
		return format.replace(/a|A|Z|S(SS)?|ss?|mm?|HH?|hh?|D{1,2}|M{1,2}|YY(YY)?|'([^']|'')*'/g, (str) => {
			let c1 = str.charAt(0);
			let ret = str.charAt(0) == "'"
				? (c1 = 0) || str.slice(1, -1).replace(/''/g, "'")
				: str == "a"
					? (me.getHours() < 12 ? "am" : "pm")
					: str == "A"
						? (me.getHours() < 12 ? "AM" : "PM")
						: str == "Z"
							? (("+" + -me.getTimezoneOffset() / 60).replace(/^\D?(\D)/, "$1").replace(/^(.)(.)$/, "$10$2") + "00")
							: c1 == "S"
								? me.getMilliseconds()
								: c1 == "s"
									? me.getSeconds()
									: c1 == "H"
										? me.getHours()
										: c1 == "h"
											? (me.getHours() % 12) || 12
											: c1 == "D"
												? me.getDate()
												: c1 == "m"
													? me.getMinutes()
													: c1 == "M"
														? me.getMonth() + 1
														: ("" + me.getFullYear()).slice(-str.length);
			return c1 && str.length < 4 && ("" + ret).length < str.length
				? ("00" + ret).slice(-str.length)
				: ret;
		});
	};
// #endregion

// #region 設定檔
if (!fs.existsSync(`${localStorage["config"]}/Data`))
	fs.mkdirSync(`${localStorage["config"]}/Data`);


if (!fs.existsSync(`${localStorage["config"]}/Data/config.json`))
	fs.writeFileSync(`${localStorage["config"]}/Data/config.json`, JSON.stringify({}), "utf8");


let config = JSON.parse(fs.readFileSync(`${localStorage["config"]}/Data/config.json`).toString());
// #endregion

// #region 初始化
try {
	dump({ level: 0, message: "Initializing", origin: "Initialization" });
	for (let index = 0; index < Object.keys(Config).length; index++)
		if (config[Object.keys(Config)[index]] == undefined)
			config[Object.keys(Config)[index]] = Config[Object.keys(Config)[index]];
	console.debug(config);
	fs.writeFileSync(`${localStorage["config"]}/Data/config.json`, JSON.stringify(config), "utf8");

	setThemeColor(config["theme.color"].value, config["theme.dark"].value);
	init();
} catch (error) {
	alert("錯誤!! 請到 TREM 官方 Discord 回報");
	dump({ level: 2, message: error, origin: "Initialization" });
}
let win = BrowserWindow.fromId(process.env.window * 1);
win.setAlwaysOnTop(false);
let time = document.getElementById("time");
document.title = `TREM | 台灣實時地震監測 | ${process.env.Version}`;

setInterval(() => {
	if (config["location.city"]["value"] != Check["city"] || config["location.town"]["value"] != Check["town"]) {
		Check["city"] = config["location.city"]["value"];
		Check["town"] = config["location.town"]["value"];
		setUserLocationMarker();
	}
	if (TimerDesynced)
		time.style.color = "red";
	else {
		time.style.color = "white";
		time.innerText = NOW.format("YYYY/MM/DD HH:mm:ss");
	}
	if (Object.keys(Tsunami).length != 0)
		if (NOW.getTime() - Tsunami.Time > 240000) {
			map.removeLayer(Tsunami.Cross);
			delete Tsunami.Cross;
			delete Tsunami.Time;
			focus();
		}

	if (Report != 0 && NOW.getTime() - Report > 600000) {
		Report = NOW.getTime();
		ReportGET({});
	}
}, 200);

function init() {
	let MAP = document.getElementById("map");

	map = L.map("map", {
		attributionControl : false,
		closePopupOnClick  : false,
	}).setView([23, 121], 7.5);

	map1 = L.map("map-1", {
		attributionControl : false,
		closePopupOnClick  : false,
	}).setView([23.608428, 120.799168], 7);

	geojson = L.geoJson(statesData, {
		style: {
			weight    : 1,
			opacity   : 0.8,
			color     : "#8E8E8E",
			fillColor : "transparent",
		},
	}).addTo(map1);

	map.on("click", (e) => {
		if (ReportMarkID != null) {
			ReportMarkID = null;
			for (let index = 0; index < MarkList.length; index++)
				map.removeLayer(MarkList[index]);

			focus();
		}
	});

	L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw", {
		maxZoom    : 14,
		id         : "mapbox/dark-v10",
		tileSize   : 512,
		zoomOffset : -1,
		minZoom    : 2,
	}).addTo(map);

	L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw", {
		maxZoom    : 14,
		id         : "mapbox/dark-v10",
		tileSize   : 512,
		zoomOffset : -1,
		minZoom    : 2,
	}).addTo(map1);

	map1.dragging.disable();
	map1.scrollWheelZoom.disable();
	map1.doubleClickZoom.disable();
	map1.removeControl(map1.zoomControl);

	map.removeControl(map.zoomControl);
	let eew = document.getElementById("map-1");
	eew.style.height = "0%";

	ReportGET({});

	setInterval(() => {
		fetch("https://raw.githubusercontent.com/ExpTechTW/TW-EEW/%E4%B8%BB%E8%A6%81%E7%9A%84-(main)/locations.json")
			.then((response) => response.json())
			.then((res) => {
				Location = res;
				fetch("https://raw.githubusercontent.com/ExpTechTW/API/master/Json/earthquake/station.json")
					.then((response) => response.json())
					.then((res1) => {
						station = res1;
						dump({ level: 0, message: "Get Station File", origin: "Location" });
						fetch("https://raw.githubusercontent.com/ExpTechTW/API/master/Json/earthquake/pga.json")
							.then((response) => response.json())
							.then((res2) => {
								PGAjson = res2;
								dump({ level: 0, message: "Get PGA Location File", origin: "Location" });
								if (config["earthquake.Real-time"]["value"])
									PGAMain();
							});
					});
			});
	}, 600_000);

	function PGAMain() {
		dump({ level: 0, message: "Start PGA Timer", origin: "PGATimer" });
		if (MainClock != null) clearInterval(MainClock);
		MainClock = setInterval(() => {
			let data = {
				"APIkey"        : "https://github.com/ExpTechTW",
				"Function"      : "data",
				"Type"          : "TREM",
				"FormatVersion" : 1,
			};

			axios.post("https://exptech.mywire.org:1015", data)
				.then((response) => {
					for (let index = 0; index < Object.keys(Station).length; index++) {
						map.removeLayer(Station[Object.keys(Station)[index]]);
						delete Station[Object.keys(Station)[index]];
						index--;
					}
					if (response.data["state"] != "Success") return;
					let Json = response.data["response"];
					let All = [];
					MAXPGA = { pga: 0, station: "NA", level: 0 };
					for (let index = 0; index < Object.keys(Json).length; index++) {
						let Sdata = Json[Object.keys(Json)[index]];
						let amount = 0;
						if (Number(Sdata["MaxPGA"]) > amount) amount = Number(Sdata["MaxPGA"]);
						if (station[Object.keys(Json)[index]] == undefined || !Sdata["Verify"]) continue;
						let Intensity = NOW.getTime() - Sdata["TimeStamp"] > 5000 ? "NA" :
							amount >= 800 ? 9 :
								amount >= 440 ? 8 :
									amount >= 250 ? 7 :
										amount >= 140 ? 6 :
											amount >= 80 ? 5 :
												amount >= 25 ? 4 :
													amount >= 8 ? 3 :
														amount >= 5 ? 2 :
															amount >= 3.5 ? 1 :
																0;
						let size = 15;
						if (Intensity == 0) size = 5;
						let myIcon = L.icon({
							iconUrl  : `./image/$${Intensity}.png`,
							iconSize : [size, size],
						});
						let ReportMark = L.marker([station[Object.keys(Json)[index]]["Lat"], station[Object.keys(Json)[index]]["Long"]], { icon: myIcon });
						let Level = IntensityI(Intensity);
						let now = new Date(Sdata["Time"]);
						let Now = (now.getMonth() + 1) +
							"/" + now.getDate() +
							" " + now.getHours() +
							":" + now.getMinutes() +
							":" + now.getSeconds();
						let Catch = document.getElementById("box-7");
						if (Object.keys(Json)[index] == config["Real-time.station"]["value"]) Catch.innerHTML = `<font color="white" size="2"><b>${station[Object.keys(Json)[index]]["Loc"]}</b></font><br><font color="white" size="2"><b>${Now}</b> </font><br><font color="white" size="2"><b>震度: ${Intensity}</b> </font><font color="white" size="2"><b> PGA: ${amount}</b></font>`;
						map.addLayer(ReportMark);
						Station[Object.keys(Json)[index]] = ReportMark;
						if (pga[station[Object.keys(Json)[index]]["PGA"]] == undefined && Intensity != "NA")
							pga[station[Object.keys(Json)[index]]["PGA"]] = {
								"Intensity" : Intensity,
								"Time"      : 0,
							};

						if (Intensity != "NA" && Intensity != 0) {
							All.push({
								"loc"       : station[Object.keys(Json)[index]]["Loc"],
								"intensity" : Intensity,
							});
							if (Intensity > pga[station[Object.keys(Json)[index]]["PGA"]]["Intensity"]) pga[station[Object.keys(Json)[index]]["PGA"]]["Intensity"] = Intensity;
							if (amount >= 3.5)
								if (Pga[Object.keys(Json)[index]]) {
									if (amount > 8 && PGALimit == 0) {
										PGALimit = 1;
										audioPlay("./audio/PGA1.wav");
									} else if (amount > 250 && PGALimit != 2) {
										PGALimit = 2;
										audioPlay("./audio/PGA2.wav");
									}
									pga[station[Object.keys(Json)[index]]["PGA"]]["Time"] = NOW.getTime();
								} else
									Pga[Object.keys(Json)[index]] = true;


							if (MAXPGA["pga"] < amount && Level != "NA") {
								MAXPGA["pga"] = amount;
								MAXPGA["station"] = Object.keys(Json)[index];
								MAXPGA["level"] = Level;
								MAXPGA["lat"] = station[Object.keys(Json)[index]]["Lat"];
								MAXPGA["long"] = station[Object.keys(Json)[index]]["Long"];
								MAXPGA["loc"] = station[Object.keys(Json)[index]]["Loc"];
								MAXPGA["intensity"] = Intensity;
								MAXPGA["ms"] = NOW.getTime() - Sdata["TimeStamp"];
							}
						} else
							delete Pga[Object.keys(Json)[index]];

					}
					if (PAlert.data != undefined)
						for (let index = 0; index < PAlert.data.length; index++) {
							if (NOW.getTime() - PAlert.timestamp > 30000) break;
							if (pga[PAlert.data[index]["TREM"]] == undefined)
								pga[PAlert.data[index]["TREM"]] = {
									"Intensity" : 0,
									"Time"      : 0,
								};

							let myIcon = L.icon({
								iconUrl  : `./image/${PAlert.data[index]["intensity"]}.png`,
								iconSize : [15, 15],
							});
							let list = PAlert.data[index]["loc"].split(" ");
							let city = list[0];
							let town = list[1];
							let ReportMark = L.marker([Location[city][town][1], Location[city][town][2]], { icon: myIcon });
							map.addLayer(ReportMark);
							Station[PAlert.data[index]["loc"]] = ReportMark;
							if (PAlert.data[index]["intensity"] > pga[PAlert.data[index]["TREM"]]["Intensity"]) pga[PAlert.data[index]["TREM"]]["Intensity"] = PAlert.data[index]["intensity"];
							pga[PAlert.data[index]["TREM"]]["Time"] = NOW.getTime();
							All.push({
								"loc"       : PAlert.data[index]["loc"],
								"intensity" : PAlert.data[index]["intensity"],
							});
							if (IntensityN(MAXPGA["level"]) < PAlert.data[index]["intensity"]) {
								MAXPGA["pga"] = "";
								MAXPGA["level"] = IntensityI(PAlert.data[index]["intensity"]);
								MAXPGA["loc"] = PAlert.data[index]["loc"];
								MAXPGA["intensity"] = PAlert.data[index]["intensity"];
							}
						}
					for (let index = 0; index < Object.keys(PGA).length; index++) {
						map.removeLayer(PGA[Object.keys(PGA)[index]]);
						delete PGA[Object.keys(PGA)[index]];
						index--;
					}
					for (let index = 0; index < Object.keys(pga).length; index++) {
						let Intensity = pga[Object.keys(pga)[index]]["Intensity"];
						if (NOW.getTime() - pga[Object.keys(pga)[index]]["Time"] > 5000) {
							delete pga[Object.keys(pga)[index]];
							index--;
						} else {
							PGA[Object.keys(pga)[index]] = L.polygon(PGAjson[Object.keys(pga)[index].toString()], {
								color     : color(Intensity),
								fillColor : "transparent",
							}).addTo(map);
							PGAaudio = true;
						}
					}
					if (Object.keys(pga).length != 0 && !PGAmark) {
						PGAmark = true;
						focus([23.608428, 120.799168], 7, true);
					}
					if (PGAmark && Object.keys(pga).length == 0) {
						PGAmark = false;
						focus();
					}
					if (Object.keys(PGA).length == 0) PGAaudio = false;
					if (PGAaudio) {
						let Catch = document.getElementById("intensity-2");
						Catch.style.height = "auto";
						Catch = document.getElementById("intensity-3");
						Catch.innerHTML = `<font color="white" size="7"><b>${MAXPGA["level"]}</b></font><br><font color="white" size="3"><b>${MAXPGA["pga"]}</b></font>`;
						Catch = document.getElementById("box-3");
						Catch.style.backgroundColor = color(MAXPGA["intensity"]);
					} else {
						let Catch = document.getElementById("intensity-2");
						Catch.style.height = "0%";
						Catch = document.getElementById("intensity-3");
						Catch.innerHTML = "";
						Catch = document.getElementById("box-3");
						Catch.style.backgroundColor = "gray";
						PGAAudio = false;
						PGAtag = 0;
						PGALimit = 0;
					}
					if (!PGAAudio && PGAaudio) {
						if (!win.isVisible())
							if (config["Real-time.show"]["value"]) {
								win.show();
								if (config["Real-time.cover"]["value"]) win.setAlwaysOnTop(true);
								win.setAlwaysOnTop(false);
							}

						PGAAudio = true;
					}
					for (let Index = 0; Index < All.length - 1; Index++)
						for (let index = 0; index < All.length - 1; index++)
							if (All[index]["intensity"] < All[index + 1]["intensity"]) {
								let Temp = All[index + 1];
								All[index + 1] = All[index];
								All[index] = Temp;
							}


					if (All.length != 0 && All[0]["intensity"] > PGAtag && Object.keys(pga).length != 0) {
						if (config["Real-time.audio"]["value"])
							if (All[0]["intensity"] >= 5 && PGAtag < 5)
								audioPlay("./audio/Shindo2.wav");
							else if (All[0]["intensity"] >= 2 && PGAtag < 2)
								audioPlay("./audio/Shindo1.wav");
							else if (PGAtag == 0)
								audioPlay("./audio/Shindo0.wav");


						if (All[0]["intensity"] >= 2) {
							let Now = NOW.getFullYear() +
								"/" + (NOW.getMonth() + 1) +
								"/" + NOW.getDate() +
								" " + NOW.getHours() +
								":" + NOW.getMinutes() +
								":" + NOW.getSeconds();
							Report = NOW.getTime();
							ReportGET({
								Max  : All[0]["intensity"],
								Time : Now,
							});
						}
						clear();
						function clear() {
							let Catch = document.getElementById("box-6");
							if (Catch.childNodes.length != 0) {
								Catch.childNodes.forEach((childNodes) => {
									Catch.removeChild(childNodes);
								});
								clear();
							} else {
								let count = 0;
								let Div;
								for (let Index = 0; Index < All.length; Index++) {
									if (!PGAaudio || count >= 10) break;
									Div = document.createElement("DIV");
									Div.innerHTML =
									`<div class="background" style="display: flex; align-items:center;padding-right: 1vh;">
									<div class="left" style="width: 30%;text-align: center;">
										<b><font color="white" size="4">${IntensityI(All[Index]["intensity"])}</font></b>
									</div>
									<div class="right">
									<b><font color="white" size="2">${All[Index]["loc"].replace(" ", "<br>")}</font></b>
									</div>
								</div>`;
									Div.style.backgroundColor = color(All[Index]["intensity"]);
									Catch.appendChild(Div);
									count++;
								}
							}
						}
					}
				})
				.catch((error) => {
					dump({ level: 2, message: error, origin: "PGATimer" });
				});
		}, 500);
	}
}
// #endregion

// #region 連接 伺服器
function reconnect() {
	if (Reconnect) return;
	Reconnect = true;
	setTimeout(() => {
		createWebSocket();
		Reconnect = false;
	}, 2000);
}

function createWebSocket() {
	try {
		ws = new WebSocket("wss://exptech.mywire.org:1015", { handshakeTimeout: 3000 });
		initEventHandle();
	} catch (e) {
		reconnect();
	}
}

function initEventHandle() {
	ws.onclose = function() {
		TimerDesynced = true;
		reconnect();
	};

	ws.onerror = function(err) {
		reconnect();
	};

	ws.onopen = function() {
		TimerDesynced = false;
		ws.send(JSON.stringify({
			"APIkey"        : "https://github.com/ExpTechTW",
			"Function"      : "earthquakeService",
			"Type"          : "subscription-v1",
			"FormatVersion" : 3,
			"UUID"          : localStorage["UUID"],
		}));
		dump({ level: 0, message: `Connected to API Server (${localStorage["UUID"]})`, origin: "WebSocket" });
	};

	ws.onmessage = function(evt) {
		let json = JSON.parse(evt.data);
		dump({ level: 3, message: `(onMessage) Received ${json.Function ?? json.response}`, origin: "WebSocket" });
		if (json.Function == "NTP") {
			lifeTime = new Date().getTime();
			TimeNow(json.Full);
		} else
			FCMdata(evt.data);

	};
}
// #endregion

// #region 用戶所在位置
async function setUserLocationMarker() {
	if (!Location) {
		Location = await (await fetch("https://raw.githubusercontent.com/ExpTechTW/TW-EEW/master/locations.json")).json();
		dump({ level: 0, message: "Get Location File", origin: "Location" });
	}

	Lat = Location[config["location.city"]["value"]][config["location.town"]["value"]][1];
	Long = Location[config["location.city"]["value"]][config["location.town"]["value"]][2];
	if (marker != null) map.removeLayer(marker);
	let myIcon = L.icon({
		iconUrl  : "./image/here.png",
		iconSize : [20, 20],
	});
	marker = L.marker([Lat, Long], { icon: myIcon });
	map.addLayer(marker);
	marker.setZIndexOffset(1);
	focus([Lat, Long], 7.5);

}
// #endregion

// #region 聚焦
function focus(Loc, size, args) {
	if (Loc != undefined && args == undefined) {
		Focus[0] = Loc[0];
		Focus[1] = Loc[1];
		Focus[2] = size;
		map.setView([Loc[0], Loc[1]], size);
	} else if (Loc != undefined)
		map.setView([Loc[0], Loc[1]], size);
	else
		map.setView([Focus[0], Focus[1]], Focus[2]);

}
// #endregion

// #region 音頻播放
let AudioT;
let audioDOM = new Audio();
audioDOM.addEventListener("ended", () => {
	audioLock = false;
});

function audioPlay(src) {
	audioList.push(src);
	if (!AudioT)
		AudioT = setInterval(async () => {
			if (!audioLock) {
				audioLock = true;
				if (audioList.length)
					await playNextAudio();
				else {
					clearInterval(AudioT);
					audioLock = false;
					AudioT = null;
				}
			}
		}, 0);
}

async function playNextAudio() {
	audioLock = true;
	const path = audioList.shift();
	audioDOM.src = path;
	audioDOM.playbackRate = 1.1;
	if (path.startsWith("./audio/1/") && config["eew.audio"]["value"]) {
		dump({ level: 0, message: `Playing Audio > ${path}`, origin: "Audio" });
		await audioDOM.play();
	} else if (!path.startsWith("./audio/1/")) {
		dump({ level: 0, message: `Playing Audio > ${path}`, origin: "Audio" });
		await audioDOM.play();

	}
}
// #endregion

// #region Report Data
function ReportGET(eew) {
	let data = {
		"APIkey"        : "https://github.com/ExpTechTW",
		"Function"      : "data",
		"Type"          : "earthquake",
		"FormatVersion" : 1,
		"Value"         : 100,
	};

	axios.post("https://exptech.mywire.org:1015", data)
		.then((response) => {
			dump({ level: 0, message: "Reports fetched", origin: "EQReportFetcher" });
			if (response.data["state"] == "Warn") {
				alert("API 速度限制\n短時間內訪問太多次伺服器\n請稍後再試");
				app.exit();
			}
			ReportList(response.data, eew);
		})
		.catch((error) => {
			dump({ level: 2, message: error, origin: "EQReportFetcher" });
		});
}
// #endregion

// #region Report 點擊
async function ReportClick(time) {
	if (ReportMarkID == time) {
		ReportMarkID = null;
		for (let index = 0; index < MarkList.length; index++)
			map.removeLayer(MarkList[index]);

		focus();
	} else {
		ReportMarkID = time;
		for (let index = 0; index < MarkList.length; index++)
			map.removeLayer(MarkList[index]);

		let LIST = [];
		if (ReportCache[time]["earthquakeNo"] != 111000) {
			let data = {
				"APIkey"        : "https://github.com/ExpTechTW",
				"Function"      : "data",
				"Type"          : "report",
				"FormatVersion" : 1,
				"Value"         : ReportCache[time]["earthquakeNo"],
			};
			axios.post("https://exptech.mywire.org:1015", data)
				.then((response) => {
					let Json = response.data.response;
					if (Json == undefined)
						main();
					else {
						for (let Index = 0; Index < Json["Intensity"].length; Index++)
							for (let index = 0; index < Json["Intensity"][Index]["station"].length; index++) {
								let Station = Json["Intensity"][Index]["station"][index];
								let Intensity = Station["stationIntensity"]["$t"];
								if (Station["stationIntensity"]["unit"] == "強") Intensity += "+";
								if (Station["stationIntensity"]["unit"] == "弱") Intensity += "-";
								var myIcon = L.icon({
									iconUrl  : `./image/${IntensityI(Intensity)}.png`,
									iconSize : [20, 20],
								});
								let ReportMark = L.marker([Station["stationLat"]["$t"], Station["stationLon"]["$t"]], { icon: myIcon });
								let PGA = "";
								if (Station["pga"] != undefined) PGA = `<br>PGA<br>垂直向: ${Station["pga"]["vComponent"]}<br>東西向: ${Station["pga"]["ewComponent"]}<br>南北向: ${Station["pga"]["nsComponent"]}<br><a onclick="openURL('${Station["waveImageURI"]}')">震波圖</a>`;
								ReportMark.bindPopup(`站名: ${Station["stationName"]}<br>代號: ${Station["stationCode"]}<br>經度: ${Station["stationLon"]["$t"]}<br>緯度: ${Station["stationLat"]["$t"]}<br>震央距: ${Station["distance"]["$t"]}<br>方位角: ${Station["azimuth"]["$t"]}<br>震度: ${Intensity}<br>${PGA}`);
								map.addLayer(ReportMark);
								ReportMark.setZIndexOffset(1000 + index);
								MarkList.push(ReportMark);
							}


						focus([Number(Json.NorthLatitude), Number(Json.EastLongitude)], 7.5, true);
						var myIcon = L.icon({
							iconUrl  : "./image/star.png",
							iconSize : [25, 25],
						});
						let ReportMark = L.marker([Number(Json.NorthLatitude), Number(Json.EastLongitude)], { icon: myIcon });
						ReportMark.bindPopup(`編號: ${Json.No}<br>經度: ${Json.EastLongitude}<br>緯度: ${Json.NorthLatitude}<br>深度: ${Json.Depth}<br>規模: ${Json.Scale}<br>位置: ${Json.Location}<br>時間: ${Json["UTC+8"]}<br><br><a onclick="openURL('${Json.Web}')">網頁</a><br><a onclick="openURL('${Json.EventImage}')">地震報告</a><br><a onclick="openURL('${Json.ShakeImage}')">震度分布</a>`);
						map.addLayer(ReportMark);
						ReportMark.setZIndexOffset(3000);
						MarkList.push(ReportMark);
					}
				})
				.catch((error) => {
					console.log(error);
				});
		} else
			main();

		function main() {
			for (let Index = 0; Index < ReportCache[time].data.length; Index++)
				for (let index = 0; index < ReportCache[time].data[Index]["eqStation"].length; index++) {
					let data = ReportCache[time].data[Index]["eqStation"][index];
					var myIcon = L.icon({
						iconUrl  : `./image/${data["stationIntensity"]}.png`,
						iconSize : [20, 20],
					});
					let level = IntensityI(data["stationIntensity"]);
					LIST.push({
						Lat       : Number(data["stationLat"]),
						Long      : Number(data["stationLon"]),
						Icon      : myIcon,
						Level     : level,
						Intensity : Number(data["stationIntensity"]),
						Name      : `${ReportCache[time].data[Index]["areaName"]} ${data["stationName"]}`,
					});
				}

			for (let Index = 0; Index < LIST.length - 1; Index++)
				for (let index = 0; index < LIST.length - 1; index++)
					if (LIST[index]["Intensity"] > LIST[index + 1]["Intensity"]) {
						let Temp = LIST[index];
						LIST[index] = LIST[index + 1];
						LIST[index + 1] = Temp;
					}


			for (let index = 0; index < LIST.length; index++) {
				let ReportMark = L.marker([LIST[index]["Lat"], LIST[index]["Long"]], { icon: LIST[index]["Icon"] });
				ReportMark.bindPopup(`站名: ${LIST[index]["Name"]}<br>經度: ${LIST[index]["Long"]}<br>緯度: ${LIST[index]["Lat"]}<br>震度: ${LIST[index]["Level"]}`);
				map.addLayer(ReportMark);
				ReportMark.setZIndexOffset(1000 + index);
				MarkList.push(ReportMark);
			}
			focus([Number(ReportCache[time].epicenterLat), Number(ReportCache[time].epicenterLon)], 7.5, true);
			var myIcon = L.icon({
				iconUrl  : "./image/star.png",
				iconSize : [25, 25],
			});
			let ReportMark = L.marker([Number(ReportCache[time].epicenterLat), Number(ReportCache[time].epicenterLon)], { icon: myIcon });
			ReportMark.bindPopup(`編號: ${ReportCache[time]["earthquakeNo"]}<br>經度: ${ReportCache[time]["epicenterLon"]}<br>緯度: ${ReportCache[time]["epicenterLat"]}<br>深度: ${ReportCache[time]["depth"]}<br>規模: ${ReportCache[time]["magnitudeValue"]}<br>位置: ${ReportCache[time]["location"]}<br>時間: ${ReportCache[time]["originTime"]}`);
			map.addLayer(ReportMark);
			ReportMark.setZIndexOffset(3000);
			MarkList.push(ReportMark);
		}
	}
}
let openURL = url => {
	shell.openExternal(url);
	return;
};
// #endregion

// #region Report list
async function ReportList(Data, eew) {
	clear();
	function clear() {
		let roll = document.getElementById("rolllist");
		if (roll.childNodes.length != 0) {
			roll.childNodes.forEach((childNodes) => {
				roll.removeChild(childNodes);
			});
			clear();
		} else
			add(eew);

	}

	async function add() {
		let roll = document.getElementById("rolllist");
		for (let index = 0; index < Data["response"].length; index++) {
			let DATA = Data["response"][index];
			var Div = document.createElement("DIV");
			let Level = IntensityI(DATA["data"][0]["areaIntensity"]);
			let msg = "";
			if (DATA["location"].includes("("))
				msg = DATA["location"].substring(DATA["location"].indexOf("(") + 1, DATA["location"].indexOf(")")).replace("位於", "");
			else
				msg = DATA["location"];

			let star = "";
			if (DATA["earthquakeNo"] != 111000) star = "✩ ";
			if (index == 0)
				if (eew.Time != undefined && eew.report == undefined) {
					Div.style.backgroundColor = color(eew.Max);
					Div.innerHTML =
                        `<div class="background" style="display: flex; align-items:center; padding:5%;padding-right: 1vh;">
                    <div class="left" style="width:30%; text-align: center">
                        <font color="white" size="3">最大震度</font><br><b><font color="white" size="7">${IntensityI(eew.Max)}</font></b>
                    </div>
                    <div class="middle" style="width:60%;">
                        <b><font color="white" size="5">震源 調查中</font></b>
                        <br><font color="white" size="3">${eew.Time}</font>
                    </div>
                    </div>`;
					roll.appendChild(Div);
					var Div = document.createElement("DIV");
					Div.innerHTML =
                        `<div class="background" style="display: flex; align-items:center;padding-right: 1vh;">
                    <div class="left" style="width:20%; text-align: center;">
                        <b><font color="white" size="6">${Level}</font></b>
                    </div>
                    <div class="middle" style="width:60%;">
                        <b><font color="white" size="4">${star}${msg}</font></b>
                        <br><font color="white" size="3">${DATA["originTime"]}</font>
                    </div>
                    <div class="right">
                    <b><font color="white" size="5">M${DATA["magnitudeValue"]}</font></b>
                    </div>
                    </div>`;
				} else
					Div.innerHTML =
                        `<div class="background" style="display: flex; align-items:center; padding:2%;padding-right: 1vh;">
                    <div class="left" style="width:30%; text-align: center;">
                        <font color="white" size="3">最大震度</font><br><b><font color="white" size="7">${Level}</font></b>
                    </div>
                    <div class="middle" style="width:60%;">
                        <b><font color="white" size="4">${star}${msg}</font></b>
                        <br><font color="white" size="2">${DATA["originTime"]}</font>
                        <br><b><font color="white" size="6">M${DATA["magnitudeValue"]} </font></b><br><font color="white" size="2"> 深度: </font><b><font color="white" size="4">${DATA["depth"]}km</font></b>
                    </div>
                </div>`;

			else
				Div.innerHTML =
                    `<div class="background" style="display: flex; align-items:center;padding-right: 1vh;">
                <div class="left" style="width:20%; text-align: center;">
                    <b><font color="white" size="6">${Level}</font></b>
                </div>
                <div class="middle" style="width:60%;">
                    <b><font color="white" size="4">${star}${msg}</font></b>
                    <br><font color="white" size="3">${DATA["originTime"]}</font>
                </div>
                <div class="right">
                <b><font color="white" size="5">M${DATA["magnitudeValue"]}</font></b>
                </div>
            </div>`;

			Div.style.backgroundColor = color(DATA["data"][0]["areaIntensity"]);
			ReportCache[DATA["originTime"]] = Data["response"][index];
			Div.addEventListener("click", () => {
				ReportClick(DATA["originTime"]);
			});
			roll.appendChild(Div);
		}
		$("#load").fadeOut(100);
		let set = document.getElementById("box-8");
		set.style.visibility = "visible";
		if (eew.report != undefined) {
			ReportClick(Data["response"][0]["originTime"]);
			setTimeout(() => {
				if (ReportMarkID != null) {
					ReportMarkID = null;
					for (let index = 0; index < MarkList.length; index++)
						map.removeLayer(MarkList[index]);

					focus();
				}
			}, 30000);
		}
	}

}
// #endregion

// #region 設定
function setting() {
	win.setAlwaysOnTop(false);
	let ipc = require("electron").ipcRenderer;
	ipc.send("openChildWindow");
}
// #endregion

// #region PGA
function PGAcount(Scale, distance, Si) {
	let S = Si ?? 1;
	if (!config["earthquake.siteEffect"]["value"]) S = 1;
	let PGA = (1.657 * Math.pow(Math.E, (1.533 * Scale)) * Math.pow(distance, -1.607) * S).toFixed(3);
	return PGA >= 800 ? "7" :
		PGA <= 800 && PGA > 440 ? "6+" :
			PGA <= 440 && PGA > 250 ? "6-" :
				PGA <= 250 && PGA > 140 ? "5+" :
					PGA <= 140 && PGA > 80 ? "5-" :
						PGA <= 80 && PGA > 25 ? "4" :
							PGA <= 25 && PGA > 8 ? "3" :
								PGA <= 8 && PGA > 2.5 ? "2" :
									PGA <= 2.5 && PGA > 0.8 ? "1" :
										"0";
}
// #endregion

// #region Number >> Intensity
function IntensityI(Intensity) {
	return Intensity == 5 ? "5-" :
		Intensity == 6 ? "5+" :
			Intensity == 7 ? "6-" :
				Intensity == 8 ? "6+" :
					Intensity == 9 ? "7" :
						Intensity ?? "?";
}
// #endregion

// #region Intensity >> Number
function IntensityN(level) {
	return level == "5-" ? 5 :
		level == "5+" ? 6 :
			level == "6-" ? 7 :
				level == "6+" ? 8 :
					level == "7" ? 9 :
						Number(level);
}
// #endregion

// #region color
function color(Intensity) {
	let Carr = ["#808080", "#0165CC", "#01BB02", "#EBC000", "#FF8400", "#E06300", "#FF0000", "#B50000", "#68009E"];
	if (Intensity == 0) return Carr[0];
	return Carr[Intensity - 1];
}
// #endregion

// #region IPC
ipcMain.on("testEEW", () => {
	_eewTest = true;
	dump({ level: 0, message: "Start EEW Test", origin: "EEW" });
	let data = {
		"APIkey"        : "https://github.com/ExpTechTW",
		"Function"      : "earthquake",
		"Type"          : "test",
		"FormatVersion" : 3,
		"UUID"          : localStorage["UUID"],
		"Addition"      : "TW",
	};
	if (config["accept.eew.jp"]["value"]) delete data["Addition"];
	dump({ level: 3, message: `Timer status: ${TimerDesynced ? "Desynced" : "Synced"}`, origin: "Verbose" });
	axios.post("https://exptech.mywire.org:1015", data)
		.catch((error) => {
			dump({ level: 2, message: error, origin: "Verbose" });
		});
});
ipcMain.on("updateTheme", () => {
	console.log("updateTheme");
	setThemeColor(config["theme.color"].value, config["theme.dark"].value);
});
ipcMain.on("updateSetting", () => {
	config = JSON.parse(fs.readFileSync(`${localStorage["config"]}/Data/config.json`).toString());
});
// #endregion

// #region FCM
ipcRenderer.on(NOTIFICATION_SERVICE_STARTED, (_, token) => {
	localStorage["UUID"] = token;
	createWebSocket();
	dump({ level: 0, message: `Service Started (${token})`, origin: "FCM" });
});

ipcRenderer.on(NOTIFICATION_SERVICE_ERROR, (_, error) => {
	dump({ level: 2, message: error, origin: "FCM" });
});

ipcRenderer.on(NOTIFICATION_RECEIVED, (_, Notification) => {
	if (Notification.data.Data != undefined)
		FCMdata(Notification.data.Data);

});

ipcRenderer.send(START_NOTIFICATION_SERVICE, "583094702393");
// #endregion

// #region NTP
function TimeNow(now) {
	ServerT = new Date().getTime();
	ServerTime = now;
}
setInterval(() => {
	NOW = new Date(ServerTime + (new Date().getTime() - ServerT));
}, 0);
// #endregion

// #region EEW
function FCMdata(data) {
	let json = JSON.parse(data);
	if (Server.includes(json.TimeStamp)) return;
	Server.push(json.TimeStamp);
	if (json.TimeStamp != undefined)
		dump({ level: 0, message: `${NOW.getTime() - json.TimeStamp}ms`, origin: "API" });

	if (json.Function == "tsunami") {
		dump({ level: 0, message: "Got Tsunami Warning", origin: "API" });
		if (config["report.show"]["value"]) {
			win.show();
			if (config["report.cover"]["value"]) win.setAlwaysOnTop(true);
			win.setAlwaysOnTop(false);
		}
		new Notification("海嘯警報", { body: `${json["UTC+8"]} 發生 ${json.Scale} 地震\n\n東經: ${json.EastLongitude} 度\n北緯: ${json.NorthLatitude} 度`, icon: "TREM.ico" });
		focus([json.NorthLatitude, json.EastLongitude], 2.5, true);
		let myIcon = L.icon({
			iconUrl  : "./image/warn.png",
			iconSize : [30, 30],
		});
		let Cross = L.marker([Number(json.NorthLatitude), Number(json.EastLongitude)], { icon: myIcon });
		if (Tsunami["Cross"] != undefined) map.removeLayer(Tsunami["Cross"]);
		Tsunami["Cross"] = Cross;
		Tsunami["Time"] = NOW.getTime();
		map.addLayer(Cross);
		if (config["report.show"]["value"]) {
			win.show();
			if (config["report.cover"]["value"]) win.setAlwaysOnTop(true);
			win.setAlwaysOnTop(false);
		}
		if (config["report.audio"]["value"]) audioPlay("./audio/Water.wav");
	} if (json.Function == "palert")
		PAlert = json.Data;
	else if (json.Function == "report") {
		dump({ level: 0, message: "Got Earthquake Report", origin: "API" });
		if (config["report.show"]["value"]) {
			win.show();
			if (config["report.cover"]["value"]) win.setAlwaysOnTop(true);
			win.setAlwaysOnTop(false);
		}
		new Notification("地震報告", { body: `${json["Location"].substring(json["Location"].indexOf("(") + 1, json["Location"].indexOf(")")).replace("位於", "")}\n${json["UTC+8"]}\n發生 M${json.Scale} 有感地震`, icon: "TREM.ico" });
		ReportGET({
			report: true,
		});
		if (config["report.audio"]["value"]) audioPlay("./audio/Notify.wav");
	} else if (json.Function == "earthquake" || ((json.Function == "JP_earthquake" || json.Function == "CN_earthquake") && config["accept.eew.jp"]["value"])) {
		dump({ level: 0, message: "Got EEW", origin: "API" });
		handler();

		async function handler() {
			Info["ID"] = json.ID;
			if (EarthquakeList[json.ID] == undefined) EarthquakeList[json.ID] = {};
			EarthquakeList[json.ID]["Time"] = json.Time;
			EarthquakeList[json.ID]["ID"] = json.ID;
			if (config["webhook.url"]["value"] != "" && json.ID != Info["webhook"] && localStorage["UUID"] != "e6471ff7-8a1f-4299-bb7f-f2220f5eb6e8") {
				Info["webhook"] = json.ID;
				let Now = NOW.getFullYear() +
                    "/" + (NOW.getMonth() + 1) +
                    "/" + NOW.getDate() +
                    " " + NOW.getHours() +
                    ":" + NOW.getMinutes() +
                    ":" + NOW.getSeconds();
				let msg = config["webhook.body"]["value"];
				msg = msg.replace("%Depth%", json.Depth).replace("%NorthLatitude%", json.NorthLatitude).replace("%Time%", json["UTC+8"]).replace("%EastLongitude%", json.EastLongitude).replace("%Scale%", json.Scale);
				if (json.Function == "earthquake")
					msg = msg.replace("%Government%", "中華民國交通部中央氣象局");
				else if (json.Function == "JP_earthquake")
					msg = msg.replace("%Government%", "日本氣象廳");
				else if (json.Function == "CN_earthquake")
					msg = msg.replace("%Government%", "成都高新減災研究所");

				msg = JSON.parse(msg);
				msg["username"] = "TREM | 台灣實時地震監測";

				msg["embeds"][0]["image"]["url"] = `http://150.117.110.118/TREM/${json.ID}/0.png`;
				msg["embeds"][0]["footer"] = {
					"text"     : `ExpTech Studio ${Now}`,
					"icon_url" : "https://raw.githubusercontent.com/ExpTechTW/API/%E4%B8%BB%E8%A6%81%E7%9A%84-(main)/image/Icon/ExpTech.png",
				};
				dump({ level: 0, message: "Posting Webhook", origin: "Webhook" });
				axios.post(config["webhook.url"]["value"], msg)
					.catch((error) => {
						dump({ level: 2, message: error, origin: "Webhook" });
					});
			}
			let value = 0;
			let distance = 0;
			let res = await fetch("https://raw.githubusercontent.com/ExpTechTW/TW-EEW/master/locations.json");
			let location = await res.json();
			let GC = {};
			let level = "";
			let MaxIntensity = 0;
			if (expected.length != 0)
				for (let index = 0; index < expected.length; index++)
					map.removeLayer(expected[index]);


			for (let index = 0; index < Object.keys(location).length; index++) {
				let city = Object.keys(location)[index];
				for (let Index = 0; Index < Object.keys(location[city]).length; Index++) {
					let town = Object.keys(location[city])[Index];
					let point = Math.sqrt(Math.pow(Math.abs(location[city][town][1] + (Number(json.NorthLatitude) * -1)) * 111, 2) + Math.pow(Math.abs(location[city][town][2] + (Number(json.EastLongitude) * -1)) * 101, 2));
					let Distance = Math.sqrt(Math.pow(Number(json.Depth), 2) + Math.pow(point, 2));
					let Level = PGAcount(json.Scale, Distance, location[city][town][3]);
					if (Lat == location[city][town][1] && Long == location[city][town][2]) {
						if (config["auto.waveSpeed"]["value"])
							if (Distance < 50) {
								Pspeed = 6.5;
								Sspeed = 3.5;
							}

						level = Level;
						value = Math.round((Distance - ((NOW.getTime() - json.Time) / 1000) * Sspeed) / Sspeed) - 5;
						distance = Distance;
					}
					let Intensity = IntensityN(Level);
					if (Intensity > MaxIntensity) MaxIntensity = Intensity;
					GC[city + town] = Intensity;
				}
			}
			let Intensity = IntensityN(level);
			if (Intensity < Number(config["eew.Intensity"]["value"])) {
				TimerDesynced = false;
				return;
			}
			map1.removeLayer(geojson);
			geojson = L.geoJson(statesData, {
				style: style,
			});
			function style(feature) {
				let name = feature.properties.COUNTY + feature.properties.TOWN;
				if (GC[name] == 0 || GC[name] == undefined)
					return {
						weight      : 1,
						opacity     : 0.8,
						color       : "#8E8E8E",
						dashArray   : "",
						fillOpacity : 1,
						fillColor   : "transparent",
					};

				return {
					weight      : 1,
					opacity     : 0.8,
					color       : "#8E8E8E",
					dashArray   : "",
					fillOpacity : 1,
					fillColor   : color(GC[name]),
				};
			}
			map1.addLayer(geojson);
			let roll = document.getElementById("rolllist");
			roll.style.height = "35%";
			let eew = document.getElementById("map-1");
			eew.style.height = "50%";
			if (json.ID != Info["Notify"]) {
				PNG1 = 0;
				if (config["eew.show"]["value"]) {
					win.show();
					if (config["eew.cover"]["value"]) win.setAlwaysOnTop(true);
				}
				let Nmsg = "";
				if (value > 0)
					Nmsg = `${value}秒後抵達`;
				else
					Nmsg = "已抵達 (預警盲區)";

				new Notification("EEW 強震即時警報", { body: `${level.replace("+", "強").replace("-", "弱")}級地震，${Nmsg}\nM ${json.Scale} ${json.Location ?? "未知區域"}`, icon: "TREM.ico" });
				audioList = [];
				Info["Notify"] = json.ID;
				if (config["eew.audio"]["value"]) audioPlay("./audio/EEW.wav");
				audioPlay(`./audio/1/${level.replace("+", "").replace("-", "")}.wav`);
				if (level.includes("+"))
					audioPlay("./audio/1/intensity-strong.wav");
				else if (level.includes("-"))
					audioPlay("./audio/1/intensity-weak.wav");
				else
					audioPlay("./audio/1/intensity.wav");

				if (value > 0 && value < 100) {
					if (value <= 10)
						audioPlay(`./audio/1/${value.toString()}.wav`);
					else if (value < 20)
						audioPlay(`./audio/1/x${value.toString().substring(1, 2)}.wav`);
					else {
						audioPlay(`./audio/1/${value.toString().substring(0, 1)}x.wav`);
						audioPlay(`./audio/1/x${value.toString().substring(1, 2)}.wav`);
					}
					audioPlay("./audio/1/second.wav");
				}
			}
			if (json.ID != Info["Warn"] && json.Alert) {
				Info["Warn"] = json.ID;
				audioPlay("./audio/Alert.wav");
			}
			let time = -1;
			let Stamp = 0;
			if (json.ID != Info["Alert"]) {
				focus([Number(json.NorthLatitude), Number(json.EastLongitude)], 7.5);
				Info["Alert"] = json.ID;
				Info["AlertS"] = value;
				if (t != null) clearInterval(t);
				t = setInterval(async () => {
					value = Math.round((distance - ((NOW.getTime() - json.Time) / 1000) * Sspeed) / Sspeed);
					if (Stamp != value && audioList.length == 0 && !audioLock) {
						Stamp = value;
						if (time >= 0) {
							audioPlay("./audio/1/ding.wav");
							time++;
							if (time >= 10)
								clearInterval(t);

						} else if (value < 100)
							if (value > 10)
								if (value.toString().substring(1, 2) == "0") {
									audioPlay(`./audio/1/${value.toString().substring(0, 1)}x.wav`);
									audioPlay("./audio/1/x0.wav");
								} else
									audioPlay("./audio/1/ding.wav");

							else if (value > 0)
								audioPlay(`./audio/1/${value.toString()}.wav`);
							else {
								audioPlay("./audio/1/arrive.wav");
								time = 0;
							}

					}
				}, 0);
			}
			if (ReportMarkID != null) {
				ReportMarkID = null;
				for (let index = 0; index < MarkList.length; index++)
					map.removeLayer(MarkList[index]);

			}
			let myIcon = L.icon({
				iconUrl  : "./image/cross.png",
				iconSize : [30, 30],
			});
			let Cross = L.marker([Number(json.NorthLatitude), Number(json.EastLongitude)], { icon: myIcon });
			let Cross1 = L.marker([Number(json.NorthLatitude), Number(json.EastLongitude)], { icon: myIcon });
			if (EarthquakeList[json.ID]["Cross"] != undefined)
				map.removeLayer(EarthquakeList[json.ID]["Cross"]);

			if (EarthquakeList[json.ID]["Cross1"] != undefined)
				map1.removeLayer(EarthquakeList[json.ID]["Cross1"]);


			EarthquakeList[json.ID]["Cross"] = Cross;
			EarthquakeList[json.ID]["Cross1"] = Cross1;
			map.addLayer(Cross);
			map1.addLayer(Cross1);
			Cross.setZIndexOffset(6000);
			Cross1.setZIndexOffset(6000);
			let Loom = 0;
			let speed = 1000;
			if (config["shock.smoothing"]["value"]) speed = 0;
			if (EarthquakeList[json.ID]["Timer"] != undefined) clearInterval(EarthquakeList[json.ID]["Timer"]);
			if (EarthquakeList["ITimer"] != undefined) clearInterval(EarthquakeList["ITimer"]);
			PNG = NOW.getTime();

			let classString = "alert-box ";

			// AlertBox: 種類
			if (json.Test || _eewTest)
				classString += "eew-test";
			else if (json.Alert)
				classString += "eew-alert";
			else if (json.Test != undefined && json.Test == null)
				classString += "eew-history";
			else
				classString += "eew-pred";

			_eewTest = false;

			let find = -1;
			for (let index = 0; index < INFO.length; index++)
				if (INFO[index]["ID"] == json.ID) {
					find = index;
					break;
				}

			if (find == -1) find = INFO.length;
			INFO[find] = {
				"ID"            : json.ID,
				alert_number    : json.Version,
				alert_intensity : MaxIntensity,
				alert_location  : json.Location ?? "未知區域",
				alert_time      : new Date(json.Time),
				alert_magnitude : json.Scale,
				alert_depth     : json.Depth,
				alert_provider  : json.Unit,
				alert_type      : classString,
				"intensity-1"   : `<font color="white" size="7"><b>${IntensityI(MaxIntensity)}</b></font>`,
				"time-1"        : `<font color="white" size="2"><b>${json["UTC+8"]}</b></font>`,
				"info-1"        : `<font color="white" size="4"><b>M ${json.Scale} </b></font><font color="white" size="3"><b> 深度: ${json.Depth} km</b></font>`,
				"level"         : `<b>${level}</b>`,
				"PS"            : color(IntensityN(level)),
				"distance"      : distance,
			};
			text();

			if (ITimer == null)
				ITimer = setInterval(() => {
					text();
				}, 1000);


			EarthquakeList[json.ID]["Timer"] = setInterval(() => {
				if (config["shock.p"]["value"]) {
					if (EarthquakeList[json.ID]["Pcircle"] != null)
						map.removeLayer(EarthquakeList[json.ID]["Pcircle"]);

					if (EarthquakeList[json.ID]["Pcircle1"] != null)
						map1.removeLayer(EarthquakeList[json.ID]["Pcircle1"]);

					let km = Math.sqrt(Math.pow((NOW.getTime() - json.Time) * Pspeed, 2) - Math.pow(Number(json.Depth) * 1000, 2));
					if (km > 0) {
						EarthquakeList[json.ID]["Pcircle"] = L.circle([Number(json.NorthLatitude), Number(json.EastLongitude)], {
							color     : "#6FB7B7",
							fillColor : "transparent",
							radius    : km,
						});
						EarthquakeList[json.ID]["Pcircle1"] = L.circle([Number(json.NorthLatitude), Number(json.EastLongitude)], {
							color     : "#6FB7B7",
							fillColor : "transparent",
							radius    : km,
						});
						map.addLayer(EarthquakeList[json.ID]["Pcircle"]);
						map1.addLayer(EarthquakeList[json.ID]["Pcircle1"]);
					}
				}
				if (EarthquakeList[json.ID]["Scircle"] != null)
					map.removeLayer(EarthquakeList[json.ID]["Scircle"]);

				if (EarthquakeList[json.ID]["Scircle1"] != null)
					map1.removeLayer(EarthquakeList[json.ID]["Scircle1"]);

				let km = Math.pow((NOW.getTime() - json.Time) * Sspeed, 2) - Math.pow(Number(json.Depth) * 1000, 2);
				if (km > 0) {
					let KM = Math.sqrt(km);
					let color = "orange";
					if (json.Alert)
						color = "red";

					let Scircle = L.circle([Number(json.NorthLatitude), Number(json.EastLongitude)], {
						color       : color,
						fillColor   : "#F8E7E7",
						fillOpacity : 0.1,
						radius      : KM,
					});
					let Scircle1 = L.circle([Number(json.NorthLatitude), Number(json.EastLongitude)], {
						color       : color,
						fillColor   : "#F8E7E7",
						fillOpacity : 0.1,
						radius      : KM,
					});
					EarthquakeList[json.ID]["Scircle"] = Scircle;
					EarthquakeList[json.ID]["Scircle1"] = Scircle1;
					map.addLayer(Scircle);
					map1.addLayer(Scircle1);
				}
				if (NOW.getTime() - json.TimeStamp > 240000 || json.Cancel && EarthquakeList[json.ID] != undefined) {
					if (json.Cancel) {
						Catch = document.getElementById("alert");
						Catch.style.display = "inline";
						Catch = document.getElementById("alert-body");
						Catch.innerHTML = "強震即時警報 已取消";
						setTimeout(() => {
							Catch = document.getElementById("alert");
							Catch.style.display = "none";
						}, 30000);
					}
					if (EarthquakeList[json.ID]["Scircle"] != undefined) map.removeLayer(EarthquakeList[json.ID]["Scircle"]);
					if (EarthquakeList[json.ID]["Pcircle"] != undefined) map.removeLayer(EarthquakeList[json.ID]["Pcircle"]);
					map.removeLayer(EarthquakeList[json.ID]["Cross"]);
					if (EarthquakeList[json.ID]["Scircle1"] != undefined) map1.removeLayer(EarthquakeList[json.ID]["Scircle1"]);
					if (EarthquakeList[json.ID]["Pcircle1"] != undefined) map1.removeLayer(EarthquakeList[json.ID]["Pcircle1"]);
					map1.removeLayer(EarthquakeList[json.ID]["Cross1"]);
					for (let index = 0; index < INFO.length; index++)
						if (INFO[index]["ID"] == json.ID) {
							TINFO = 0;
							INFO.splice(index, 1);
							break;
						}

					clearInterval(EarthquakeList[json.ID]["Timer"]);
					Catch = document.getElementById("box-10");
					Catch.innerHTML = "";
					delete EarthquakeList[json.ID];
					if (Object.keys(EarthquakeList).length == 0) {
						clearInterval(t);
						clearInterval(ITimer);
						$("#alert-box").removeClass("show");
						ITimer = null;
						focus([Lat, Long], 7.5);
						eew.style.height = "0%";
						Catch = document.getElementById("PS");
						Catch.style.height = "0%";
						Catch = document.getElementById("box-5");
						Catch.style.height = "0%";
						Catch = document.getElementById("box-4");
						Catch.style.height = "0%";
						TimerDesynced = false;
						audioList = [];
						INFO = [];
						win.setAlwaysOnTop(false);
						for (let index = 0; index < expected.length; index++)
							map.removeLayer(expected[index]);

						expected = [];
					} else
						focus();

				}
				if (config["map.autoZoom"]["value"]) {
					if ((NOW.getTime() - json.Time) * Pspeed > 250000 && Loom < 250000) {
						Loom = 250000;
						focus([Number(json.NorthLatitude), Number(json.EastLongitude)], 7);
					}
					if ((NOW.getTime() - json.Time) * Pspeed > 500000 && Loom < 500000) {
						Loom = 500000;
						focus([Number(json.NorthLatitude), Number(json.EastLongitude)], 6.5);
					}
					if ((NOW.getTime() - json.Time) * Pspeed > 750000 && Loom < 750000) {
						Loom = 750000;
						focus([Number(json.NorthLatitude), Number(json.EastLongitude)], 6);
					}
				}
			}, speed);

			function text() {
				let intensity = INFO[TINFO].alert_intensity;
				let intensity_str = (intensity == 9)
					? " seven"
					: (intensity == 8)
						? " six strong"
						: (intensity == 7)
							? " six"
							: (intensity == 6)
								? " five strong"
								: (intensity == 5)
									? " five"
									: (intensity == 4)
										? " four"
										: (intensity == 3)
											? " three"
											: (intensity == 2)
												? " two"
												: " one";

				$("#alert-box")[0].className = INFO[TINFO].alert_type + intensity_str;
				$("#alert-provider").text(INFO[TINFO].alert_provider);
				$("#alert-number").text(`#${INFO[TINFO].alert_number}`);
				$("#alert-location").text(INFO[TINFO].alert_location);
				$("#alert-time").text(INFO[TINFO].alert_time.format("YYYY/MM/DD HH:mm:ss"));
				$("#alert-magnitude").text(INFO[TINFO].alert_magnitude);
				$("#alert-depth").text(INFO[TINFO].alert_depth);
				$("#alert-box").addClass("show");


				let Catch = document.getElementById("title-1");
				Catch = document.getElementById("level");
				Catch.innerHTML = INFO[TINFO]["level"];
				Catch = document.getElementById("PS");
				Catch.style.backgroundColor = INFO[TINFO]["PS"];

				let num = Math.round((INFO[TINFO]["distance"] - ((NOW.getTime() - INFO[TINFO]["Time"]) / 1000) * Sspeed) / Sspeed);
				if (num <= 0) num = "抵達";
				Catch = document.getElementById("Ss");
				Catch.innerHTML = `<b>${num}</b>`;
				num = Math.round((INFO[TINFO]["distance"] - ((NOW.getTime() - INFO[TINFO]["Time"]) / 1000) * Pspeed) / Pspeed);
				if (num <= 0) num = "抵達";
				Catch = document.getElementById("Ps");
				Catch.innerHTML = `<b>${num}</b>`;
				Catch = document.getElementById("PS");
				Catch.style.height = "15%";

				let Num = Math.round(((NOW.getTime() - INFO[TINFO]["Time"]) * 4 / 10) / INFO[TINFO]["Depth"]);
				Catch = document.getElementById("box-10");
				if (Num <= 100)
					Catch.innerHTML = `<font color="white" size="6"><b>震波到地表進度: ${Num}%</b></font>`;
				else
					Catch.innerHTML = "";


				if (TINFO + 1 >= INFO.length)
					TINFO = 0;
				else
					TINFO++;
			}
		}
	}
}
// #endregion