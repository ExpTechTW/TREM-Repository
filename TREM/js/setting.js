const $ = require("jquery");
const ipc = require("electron").ipcRenderer;
const { shell } = require("@electron/remote");

let Loc;
let config = JSON.parse(fs.readFileSync(`${localStorage["config"]}/Data/config.json`).toString());

setThemeColor(config["theme.color"].value, config["theme.dark"].value);

document.getElementById("title").innerText = `TREM | 設定 | ${process.env.Version}`;
document.getElementById("ver").innerText = `TREM 版本號: ${process.env.Version}`;
document.getElementById("uuid").innerText = `UUID: ${localStorage["UUID"]}`;

const lockScroll = state => {
	if (state) {
		$("body").css({ "overflow": "hidden" });
		$(document).off("scroll", () => window.scrollTo(0, 0));
	} else {
		$(document).off("scroll");
		$("body").css({ "overflow": "visible" });
	}
};

const showDialog = (type, title, message, button = 0, customIcon, callback) => {
	const container = document.getElementById("modal-overlay");
	const icon = document.createElement("span");
	icon.classList.add("material-symbols-rounded");
	icon.classList.add("dialog-icon");
	icon.textContent = customIcon != undefined ? customIcon : (type == "success" ? "check" : (type == "warn" ? "warning" : "error"));

	const headline = document.createElement("span");
	headline.classList.add("dialog-headline");
	headline.textContent = title;

	const supportingText = document.createElement("span");
	supportingText.classList.add("dialog-supportText");
	supportingText.innerHTML = message;

	const dialog = document.createElement("div");
	dialog.classList.add("dialog");

	const closeDialog = event => {
		if (!event.target.id.includes("dialog"))
			if (event.target != container)
				return;
		lockScroll(false);
		$("#modal-overlay").fadeOut({ duration: 100, complete: () => container.replaceChildren() }).delay(100).show();
	};

	const buttons = document.createElement("div");
	buttons.classList.add("dialog-button");
	if (button == 1) {
		const Accept = document.createElement("button");
		Accept.classList.add("flat-button");
		Accept.id = "dialog-Accept";
		Accept.textContent = "確定";
		Accept.onclick = (...args) => {
			closeDialog(...args);
			callback();
		};
		buttons.appendChild(Accept);

		const Cancel = document.createElement("button");
		Cancel.classList.add("flat-button");
		Cancel.id = "dialog-Cancel";
		Cancel.textContent = "取消";
		Cancel.onclick = closeDialog;
		buttons.appendChild(Cancel);
	} else {
		const OK = document.createElement("button");
		OK.classList.add("flat-button");
		OK.id = "dialog-OK";
		OK.textContent = "OK";
		OK.onclick = closeDialog;
		buttons.appendChild(OK);
	}

	dialog.appendChild(icon);
	dialog.appendChild(headline);
	dialog.appendChild(supportingText);
	dialog.appendChild(buttons);
	container.appendChild(dialog);
	container.onclick = closeDialog;

	$("#modal-overlay").fadeIn(50);

	buttons.querySelector(":last-child").contentEditable = true;
	buttons.querySelector(":last-child").focus();
	buttons.querySelector(":last-child").contentEditable = false;
	lockScroll(true);
};


const openURL = url => {
	shell.openExternal(url);
	return;
};

// #region 選單
fetch("https://raw.githubusercontent.com/ExpTechTW/TW-EEW/master/locations.json")
	.then(async res => await res.json())
	.then(loc => {
		Loc = loc;
		for (let i = 0; i < Object.keys(Loc).length; i++) {
			const city = document.getElementById("location.city");
			const option = document.createElement("option");
			option.text = Object.keys(Loc)[i];
			option.value = Object.keys(Loc)[i];
			city.appendChild(option);
		}
		for (let i = 0; i < Object.keys(Loc[config["location.city"].value]).length; i++) {
			const town = document.getElementById("location.town");
			const option = document.createElement("option");
			option.text = Object.keys(Loc[config["location.city"].value])[i];
			option.value = Object.keys(Loc[config["location.city"].value])[i];
			town.appendChild(option);
		}

		init();
	});

fetch("https://raw.githubusercontent.com/ExpTechTW/API/master/Json/earthquake/station.json")
	.then(async res => await res.json())
	.then(loc => {
		for (let index = 0; index < Object.keys(loc).length; index++) {
			if (Object.keys(loc)[index] == "List") continue;
			const select = document.getElementById("Real-time.station");
			const option = document.createElement("option");
			option.text = `${loc[Object.keys(loc)[index]]["Loc"]} ${Object.keys(loc)[index]}`;
			option.value = Object.keys(loc)[index];
			select.appendChild(option);
		}
	});
// #endregion

/**
 * 初始化設定
 */
function init() {
	dump({ level: 0, message: "Initializing", origin: "Setting" });
	Object.keys(config).forEach(id => {
		switch (config[id].type) {
			case "CheckBox": {
				const element = document.getElementById(id);
				if (element)
					element.checked = config[id].value;
				break;
			}

			case "TextBox": {
				const element = document.getElementById(id);
				if (element)
					element.value = config[id].value;
				break;
			}

			case "SelectBox": {
				/**
				 * @type {HTMLSelectElement}
				 */
				const element = document.getElementById(id);
				if (element)
					for (let i = 0; i < element.options.length; i++)
						if (element.options[i].value == config[id].value)
							element.options[i].selected = true;
				break;
			}

			case "ColorBox": {
				/**
				 * @type {HTMLSelectElement}
				 */
				const element = document.getElementById(id);
				if (element)
					element.value = config[id].value;
				const wrapper = document.getElementById(id.replace(".", "-"));
				if (element)
					wrapper.style.backgroundColor = config[id].value;
				break;
			}

			default:
				break;
		}
	});
}

/**
 * 儲存設定檔
 */
function save() {
	dump({ level: 0, message: "Saving user preference", origin: "Setting" });
	fs.writeFileSync(`${localStorage.config}/Data/config.json`, JSON.stringify(config), "utf8");
	ipc.send("updateSetting");
}

function SelectSave(id) {
	const select = document.getElementById(id);
	const value = select.options[select.selectedIndex].value;
	dump({ level: 0, message: `Value Changed ${id}: ${config[id].value} -> ${value}`, origin: "Setting" });
	config[id].value = value;
	save();
	if (id == "location.city") {
		const town = document.getElementById("location.town");
		town.replaceChildren();

		Object.keys(Loc[value]).forEach(key => {
			const option = document.createElement("option");
			option.text = key;
			option.value = key;
			town.appendChild(option);
		});

		SelectSave("location.town");
	}
}

function CheckSave(id) {
	const value = document.getElementById(id).checked;
	dump({ level: 0, message: `Value Changed ${id}: ${config[id].value} -> ${value}`, origin: "Setting" });
	config[id].value = value;
	save();
	if (id == "GPU.disable")
		$("#HAReloadButton").fadeIn(100);
	else if (id == "theme.dark") {
		setThemeColor(config["theme.color"].value, value);
		ipc.send("updateTheme");
	}
}

function TextSave(id) {
	const value = document.getElementById(id).value;
	dump({ level: 0, message: `Value Changed ${id}: ${config[id].value} -> ${value}`, origin: "Setting" });
	config[id].value = value;
	save();
	if (id == "theme.color") {
		setThemeColor(value, config["theme.dark"].value);
		ipc.send("updateTheme");
	}
}


/**
 * 切換設定分類
 * @param {string} args 設定分類
 * @param {HTMLElement} el 觸發事件的物件
 * @param {Event} event 事件
 * @returns {void}
 */
function setList(args, el, event) {
	if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ")
		return;

	dump({ level: 0, message: `Changed view to ${args}`, origin: "Setting" });
	const currentel = $(".show");
	const changeel = $(`#${args}`);

	if (changeel.attr("id") == currentel.attr("id")) return;

	const currentnav = $(".active");
	currentnav.removeClass("active");
	$(el).addClass("active");

	currentel.fadeOut(100).removeClass("show").show();
	changeel.delay(100).hide().addClass("show").fadeIn(200);
}

function testEEW() {
	ipc.send("testEEW");
	ipc.send("closeChildWindow");
}

function reset() {
	showDialog("warn", "重置設定？", "您確定您真的要重置所有設定嗎\n這個動作將無法挽回", 1, "device_reset", () => {
		config = {};
		save();
		restart();
	});
}

const restart = () => {
	ipc.send("restart");
};

const testAudioState = {
	audio      : new Audio(),
	is_playing : false,
};
let testAudioBtn;
testAudioState.audio.addEventListener("ended", () => {
	testAudioState.is_playing = false;
	testAudioBtn.childNodes[1].textContent = "play_arrow";
	testAudioBtn.childNodes[3].textContent = "測試音效";
});

/**
 * @param {string} audioString
 * @param {HTMLElement} el
 */
const testAudio = (audioString, el) => {
	if (el != testAudioBtn && testAudioBtn != undefined) {
		testAudioState.audio.pause();
		testAudioState.audio.currentTime = 0;
		testAudioState.is_playing = false;
		testAudioBtn.childNodes[1].textContent = "play_arrow";
		testAudioBtn.childNodes[3].textContent = "測試音效";
	}
	testAudioBtn = el;
	if (!testAudioState.is_playing) {
		testAudioState.audio.src = `../Audio/${audioString}.wav`;
		testAudioState.audio.load();
		testAudioState.audio.play();
		testAudioState.is_playing = true;
		el.childNodes[1].textContent = "pause";
		el.childNodes[3].textContent = "停止測試";
	} else {
		testAudioState.audio.pause();
		testAudioState.audio.currentTime = 0;
		testAudioState.is_playing = false;
		el.childNodes[1].textContent = "play_arrow";
		el.childNodes[3].textContent = "測試音效";
	}
};

const webhook = async () => {
	if (config["webhook.url"].value.length == 0)
		return showDialog("error", "Webhook 錯誤", "Webhook 連結為空，無法傳送測試訊息");

	const url = config["webhook.url"].value.match(
		// eslint-disable-next-line no-useless-escape
		/^https?:\/\/(?:canary|ptb)?\.?discord\.com\/api\/webhooks(?:\/v[0-9]\d*)?\/([^\/]+)\/([^\/]+)/i,
	);

	if (!url || url.length <= 1)
		return showDialog("error", "Webhook 測試", "無效的 Webhook 連結");

	const { MessageEmbed, WebhookClient } = require("discord.js");

	const embeds = [
		new MessageEmbed()
			.setDescription("這是一則由 TREM 發送的測試訊息")
			.setColor("BLUE")
			.setFooter({ text: "ExpTech Studio", iconURL: "https://raw.githubusercontent.com/ExpTechTW/API/%E4%B8%BB%E8%A6%81%E7%9A%84-(main)/image/Icon/ExpTech.png" })
			.setTimestamp(),
	];

	await new WebhookClient({ url: config["webhook.url"].value })
		.send({ embeds, username: "TREM | 台灣實時地震監測", avatarURL: "https://cdn.discordapp.com/attachments/976452418114048051/976469802644291584/received_1354357138388018.webp" })
		.then(m => {
			showDialog("success", "Webhook 測試", `Webhook 發送測試訊息成功\n訊息ID：${m.id}\n頻道ID：${m.channel_id}`);
		}).catch(error => {
			showDialog("error", "Webhook 測試", `Webhook 發送測試訊息時發生錯誤\n${error}`);
		});
};

const colorUpdate = () => {
	$("#theme-color")[0].style.backgroundColor = $("#theme\\.color")[0].value;
};