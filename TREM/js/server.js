/* eslint-disable prefer-const */
const {
	NOTIFICATION_RECEIVED,
	NOTIFICATION_SERVICE_ERROR,
	NOTIFICATION_SERVICE_STARTED,
	START_NOTIFICATION_SERVICE,
} = require("electron-fcm-push-receiver/src/constants");
const WebSocket = require("ws");
const crypto = require("crypto");
const ipc = require("electron").ipcRenderer;

const ServerVer = "1.0.0";
let MD5Check = false;

let DATA;
let DATAstamp = 0;

let ws;
let Reconnect = false;
let TimerDesynced = false;
let ServerT = 0;
let ServerTime = 0;
let NOW = new Date();
let IP = {
	"HTTP"      : [],
	"WEBSOCKET" : [],
};
let LifeTime = {};

let Pdata = {
	"APIkey"   : "https://github.com/ExpTechTW",
	"Function" : "proxy",
};
axios.post("https://exptech.mywire.org:1015/", Pdata)
	.then((response) => {
		let data = response.data.response.online;
		for (let index = 0; index < Object.keys(data.HTTP).length; index++) {
			LifeTime[`http://${Object.keys(data.HTTP)[index]}/`] = data.HTTP[Object.keys(data.HTTP)[index]];
			IP.HTTP.push(`http://${Object.keys(data.HTTP)[index]}/`);
			console.log(`http://${Object.keys(data.HTTP)[index]}/`);
		}
		for (let index = 0; index < Object.keys(data.WEBSOCKET).length; index++) {
			LifeTime[`ws://${Object.keys(data.WEBSOCKET)[index]}/`] = data.WEBSOCKET[Object.keys(data.WEBSOCKET)[index]];
			IP.WEBSOCKET.push(`ws://${Object.keys(data.WEBSOCKET)[index]}/`);
		}
		for (let index = 0; index < Object.keys(data.SSL).length; index++) {
			LifeTime[`https://${Object.keys(data.SSL)[index]}/`] = data.SSL[Object.keys(data.SSL)[index]];
			LifeTime[`wss://${Object.keys(data.SSL)[index]}/`] = data.SSL[Object.keys(data.SSL)[index]];
			IP.HTTP.push(`https://${Object.keys(data.SSL)[index]}/`);
			IP.WEBSOCKET.push(`wss://${Object.keys(data.SSL)[index]}/`);
		}
		TimeNow(response.data.response.Full);
		ipcRenderer.send(START_NOTIFICATION_SERVICE, "583094702393");
	});

function PostIP() {
	if (IP.HTTP.length == 0) return "https://exptech.mywire.org:1015/";
	let url = IP.HTTP[Math.floor((Math.random() * IP.HTTP.length))];
	if (NOW.getTime() - LifeTime[url] > 30000) {
		IP.HTTP.splice(IP.HTTP.indexOf(url), 1);
		return "https://exptech.mywire.org:1015/";
	}
	return url;
}

function WebsocketIP() {
	if (IP.WEBSOCKET.length == 0) return "wss://exptech.mywire.org:1015/";
	let url = IP.WEBSOCKET[Math.floor((Math.random() * IP.WEBSOCKET.length))];
	if (NOW.getTime() - LifeTime[url] > 30000) {
		IP.WEBSOCKET.splice(IP.WEBSOCKET.indexOf(url), 1);
		return "wss://exptech.mywire.org:1015/";
	}
	return url;
}

ipcRenderer.on(NOTIFICATION_SERVICE_STARTED, (_, token) => {
	localStorage.UUID = token;
	createWebSocket();
	ipc.send("start");
	dump({ level: 0, message: `Service Started (${token})`, origin: "FCM" });
});

ipcRenderer.on(NOTIFICATION_SERVICE_ERROR, (_, error) => {
	dump({ level: 2, message: error, origin: "FCM" });
});

ipcRenderer.on(NOTIFICATION_RECEIVED, (_, Notification) => {
	if (Notification.data.Data != undefined) {
		DATA = Notification.data.Data;
		DATAstamp = new Date().getTime();
	}
});

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
			"UUID"          : localStorage.UUID,
		}));
		dump({ level: 0, message: `Connected to API Server (${localStorage.UUID})`, origin: "WebSocket" });
	};

	ws.onmessage = function(evt) {
		let json = JSON.parse(evt.data);
		dump({ level: 3, message: `(onMessage) Received ${json.Function ?? json.response}`, origin: "WebSocket" });
		if (json.Function == "NTP") {
			IP = {
				"HTTP"      : [],
				"WEBSOCKET" : [],
			};
			let data = json.online;
			for (let index = 0; index < Object.keys(data.HTTP).length; index++) {
				LifeTime[`http://${Object.keys(data.HTTP)[index]}/`] = data.HTTP[Object.keys(data.HTTP)[index]];
				IP.HTTP.push(`http://${Object.keys(data.HTTP)[index]}/`);
			}
			for (let index = 0; index < Object.keys(data.WEBSOCKET).length; index++) {
				LifeTime[`ws://${Object.keys(data.WEBSOCKET)[index]}/`] = data.WEBSOCKET[Object.keys(data.WEBSOCKET)[index]];
				IP.WEBSOCKET.push(`ws://${Object.keys(data.WEBSOCKET)[index]}/`);
			}
			for (let index = 0; index < Object.keys(data.SSL).length; index++) {
				LifeTime[`https://${Object.keys(data.SSL)[index]}/`] = data.SSL[Object.keys(data.SSL)[index]];
				LifeTime[`wss://${Object.keys(data.SSL)[index]}/`] = data.SSL[Object.keys(data.SSL)[index]];
				IP.HTTP.push(`https://${Object.keys(data.SSL)[index]}/`);
				IP.WEBSOCKET.push(`wss://${Object.keys(data.SSL)[index]}/`);
			}
			TimeNow(json.Full);
		} else {
			DATA = evt.data;
			DATAstamp = new Date().getTime();
		}
	};
}

function TimeNow(now) {
	ServerT = new Date().getTime();
	ServerTime = now;
}

setInterval(() => {
	NOW = new Date(ServerTime + (new Date().getTime() - ServerT));
}, 0);

let md5 = crypto.createHash("md5");

fetch("https://raw.githubusercontent.com/ExpTechTW/API/master/Json/earthquake/md5.json")
	.then((response) => response.json())
	.then((res) => {
		try {
			console.log(app.getVersion() + "-1");
			let md51 = md5.update(fs.readFileSync(app.getPath("temp").replace("Temp", "Programs/trem/resources/app/index.html")).toString()).digest("hex");
			let md52 = md5.update(fs.readFileSync(app.getPath("temp").replace("Temp", "Programs/trem/resources/app/js/earthquake.js")).toString()).digest("hex");
			if (res[app.getVersion() + "-1"] == md51 && res[app.getVersion() + "-2"] == md52)
				MD5Check = true;
			// eslint-disable-next-line no-empty
		} catch (error) {
		}
	});