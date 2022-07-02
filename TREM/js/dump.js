if (!fs.existsSync(`${localStorage["config"]}/Log`)) {
    fs.mkdirSync(`${localStorage["config"]}/Log`)
}

if (!fs.existsSync(`${localStorage["config"]}/Log/TREM.log`)) {
    fs.writeFileSync(`${localStorage["config"]}/Log/TREM.log`, "", 'utf8')
}

let Dump = fs.readFileSync(`${localStorage["config"]}/Log/TREM.log`).toString()

function dump(msg, type) {
    if (type == undefined) type = "Info"
    let now = new Date()
    let Now = now.getFullYear() +
        "/" + (now.getMonth() + 1) +
        "/" + now.getDate() +
        " " + now.getHours() +
        ":" + now.getMinutes() +
        ":" + now.getSeconds()
    let list = Dump.split("\n")
    if (list.length > 1000) Dump = ""
    Dump = `[${Now}] ${type} >> ${msg}\n` + Dump
    fs.writeFileSync(`${localStorage["config"]}/Log/TREM.log`, Dump, 'utf8')
}

function dumpUpload() {
    let msg = {
        "APIkey": "https://github.com/ExpTechTW",
        "Function": "data",
        "Type": "TREM-Dump",
        "FormatVersion": 1,
        "Value": Dump,
        "UUID": localStorage["UUID"]
    }
    axios.post("https://exptech.mywire.org:1015", msg)
        .then(function (response) {
            if (response.data.response == "Speed limit") {
                alert("Dump 發送限制\n稍等 5 分鐘後再次嘗試")
            } else {
                alert("Dump 發送成功")
                fs.writeFileSync(`${localStorage["dirname"]}/Log/TREM.log`, "", 'utf8')
            }
        })
        .catch(function (error) {
            alert("Dump 發送失敗\nError > " + error)
        })
}