#include <WiFi.h>
#include <RDTS.h>
#include <Arduino.h>
#include <AsyncTCP.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <ESP32httpUpdate.h>
#include <esp_task_wdt.h>
#include "ESPAsyncWebServer.h"
#include <EEPROM.h>
#include "ArduinoNvs.h"
#include <ArduinoJson.h>
#include "time.h"
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH1106_ESP32.h>
#include <math.h>

Adafruit_SH1106_ESP32 display(21, 22);
WiFiMulti WiFiMulti;
using namespace websockets;
WebsocketsClient RDTS;
AsyncWebServer server(1015);
StaticJsonDocument<4096> JSON;
DynamicJsonDocument json(4096);

String ver = "1.1";
String ssid = "";
String pass = "";
uint32_t chipId = 0;
String UID = "";
String Token = "";
String model = "ET_Smart_Socket";
char json_string[4096];
unsigned long Time = 0;
int state = 0;
int start = 0;
const char* ntpServer = "pool.ntp.org";
unsigned long epochTime;
unsigned long TIME;

double lng = 120.2940045;
double lat = 22.9672860;
double S = 1.751;

void eepromread() {
  ssid = NVS.getString("ssid");
  pass = NVS.getString("pass");
  UID = NVS.getString("UID");
  if (NVS.getString("state") == "" || NVS.getString("state") == "0") {
    state = 0;
    digitalWrite(15, LOW);
  } else {
    state = 1;
    digitalWrite(15, HIGH);
  }
}

unsigned long getTime() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return (0);
  }
  time(&now);
  return now;
}

void reset() {
  NVS.setString("ssid", "");
  NVS.setString("pass", "");
  NVS.setString("UID", "");
  NVS.setString("Token", "");
  NVS.setString("state", "");
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  ESP.restart();
}

void Data() {
  json["ver"] =  ver;
  json["Function"] = "device";
  json["Type"] =  "info";
  json["EEW"] = true;
  json["SketchMD5"] = ESP.getSketchMD5();
  json["RSSI"] = WiFi.RSSI();
  json["SSID"] =  WiFi.SSID();
  json["UID"] = UID;
  json["model"] = model;
  json["macAddress"] = WiFi.macAddress();
  json["localIP"] = WiFi.localIP().toString();
  json["ChipRevision"] = ESP.getChipRevision();
  json["CpuFreqMHz"] = ESP.getCpuFreqMHz();
  json["FreeHeap"] = ESP.getFreeHeap();
  json["FreeSketchSpace"] = ESP.getFreeSketchSpace();
  json["HeapSize"] = ESP.getHeapSize();
  json["MaxAllocHeap"] = ESP.getMaxAllocHeap();
  json["MinFreeHeap"] = ESP.getMinFreeHeap();
  json["SdkVersion"] = ESP.getSdkVersion();
  json["SketchSize"] =  ESP.getSketchSize();
  json["UUID"] = chipId;
  json["Token"] = NVS.getString("Token");
  json["tag"] = NVS.getString("tag");
  json["Time"] = TIME;
  json["state"] = state;
  serializeJson(json, json_string);
}

void Server() {
  digitalWrite(LED_BUILTIN, LOW);
  delay(200);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(300);
  digitalWrite(LED_BUILTIN, LOW);
  delay(200);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(300);
  digitalWrite(LED_BUILTIN, LOW);
  delay(200);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(300);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}

void setup() {
  setCpuFrequencyMhz(240);
  EEPROM.begin(4096);
  configTime(0, 0, ntpServer);
  NVS.begin();
  if (NVS.getString("tag") == "") {
    NVS.setString("tag", "school");
  }
  for (int i = 0; i < 17; i = i + 8) {
    chipId |= ((ESP.getEfuseMac() >> (40 - i)) & 0xff) << i;
  }
  Serial.begin(115200);

  display.begin(SH1106_SWITCHCAPVCC, 0x3C);

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 0);
  display.println("Connecting to Server");
  display.display();

  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(0, INPUT_PULLUP);
  pinMode(15, OUTPUT);

  Serial.println(ver);
  Serial.println(NVS.getString("tag"));
  WiFi.mode(WIFI_AP_STA);
  eepromread();

  if (state == 0) {
    digitalWrite(15, HIGH);
  } else {
    digitalWrite(15, LOW);
  }

  WiFiMulti.addAP(ssid.c_str(), pass.c_str());
  if (ssid != "") {
    digitalWrite(LED_BUILTIN, HIGH);
    for (int i = 0; i < 30 && WiFiMulti.run() != WL_CONNECTED; i++) {
      if (digitalRead(0) == LOW) {
        reset();
      }
    }
    digitalWrite(LED_BUILTIN, LOW);
    if (WiFiMulti.run() != WL_CONNECTED) {
      ESP.restart();
    }
    while (true) {
      if (RDTS.RDTSconnect()) {
        Data();
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(WHITE);
        display.setCursor(0, 0);
        display.println("Connecting to NTP");
        display.display();
        RDTS.send(json_string);
        break;
      }
      Server();
    }
    RDTS.onMessage([&](WebsocketsMessage message) {
      deserializeJson(JSON, message.data());
      Serial.println(message.data());
      if (JSON["Function"].as<String>() == "earthquake") {
        esp_task_wdt_delete(NULL);
        int value = 100;
        double point = sqrt(pow(abs(lat + JSON["NorthLatitude"].as<double>() * -1) * 111, 2) + pow(abs(lng + JSON["EastLongitude"].as<double>() * -1) * 101, 2));
        double distance = sqrt(pow(JSON["Depth"].as<double>(), 2) + pow(point, 2));
        double PGA = 1.657 * exp(1.533 * JSON["Scale"].as<double>()) * pow(distance, -1.607);
        String level = "0";
        if (PGA >= 800) {
          level = "7";
        } else if (800 >= PGA && 440 < PGA) {
          level = "6+";
        } else if (440 >= PGA && 250 < PGA) {
          level = "6-";
        } else if (250 >= PGA && 140 < PGA) {
          level = "5+";
        } else if (140 >= PGA && 80 < PGA) {
          level = "5-";
        } else if (80 >= PGA && 25 < PGA) {
          level = "4";
        } else if (25 >= PGA && 8 < PGA) {
          level = "3";
        } else if (8 >= PGA && 2.5 < PGA) {
          level = "2";
        } else if (2.5 >= PGA && 0.8 < PGA) {
          level = "1";
        } else {
          level = "0";
        }
        while (value > 0) {
          int TimeNow = getTime();
          value = round((distance - (TimeNow  - JSON["Time"].as<String>().substring(0, 10).toInt()) * 3.5) / 3.5);
          display.clearDisplay();
          display.setTextSize(1);
          display.setTextColor(WHITE);
          display.setCursor(0, 0);
          display.println("Intensity");
          display.setTextSize(4);
          display.setCursor(10, 10);
          display.println(level);
          display.setTextSize(5);
          if (value >= 10) {
            display.setCursor(65, 15);
          } else {
            display.setCursor(90, 15);
          }
          display.println(value);
          display.setTextSize(1);
          display.setCursor(15, 45);
          display.println("PGA");
          display.setCursor(15, 55);
          display.println(PGA);
          display.display();
        }
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(WHITE);
        display.setCursor(0, 0);
        display.println("E: " + JSON["EastLongitude"].as<String>());
        display.setCursor(0, 10);
        display.println("N: " + JSON["NorthLatitude"].as<String>());
        display.setCursor(0, 20);
        display.println("Depth: " + JSON["Depth"].as<String>());
        display.setCursor(0, 30);
        display.println("Scale: " + JSON["Scale"].as<String>());
        display.setCursor(0, 40);
        display.println("MaxIntensity: " + JSON["MaximumSeismicIntensity"].as<String>());
        display.setCursor(0, 50);
        display.println("Intensity: " + level);
        display.setCursor(110, 0);
        display.println("EEW");
        display.display();
        esp_task_wdt_add(NULL);
      } else if (JSON["Function"].as<String>() == "report") {
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(WHITE);
        display.setCursor(0, 0);
        display.println("E: " + JSON["EastLongitude"].as<String>());
        display.setCursor(0, 10);
        display.println("N: " + JSON["NorthLatitude"].as<String>());
        display.setCursor(0, 20);
        display.println("Depth: " + JSON["Depth"].as<String>());
        display.setCursor(0, 30);
        display.println("Scale: " + JSON["Scale"].as<String>());
        display.setCursor(90, 0);
        display.println("Report");
        display.display();
      } else if (JSON["Function"].as<String>() == "update") {
        esp_task_wdt_delete(NULL);
        t_httpUpdate_return ret = ESPhttpUpdate.update(JSON["Value"].as<String>());
        switch (ret) {
          case HTTP_UPDATE_FAILED:
            RDTS.send("UPDATE_FAILD");
            break;
        }
      } else if (JSON["Function"].as<String>() == "restart") {
        ESP.restart();
      }
      Time = millis();
    });
  } else {
    WiFi.softAP(model.c_str(), "1234567890");
    server.on("/get", HTTP_GET, [] (AsyncWebServerRequest * request) {
      String function;
      String message;
      if (request->hasParam("function")) {
        function = request->getParam("function")->value();
        if (function == "wifi") {
          NVS.setString("ssid", request->getParam("ssid")->value());
          NVS.setString("pass", request->getParam("pass")->value());
          NVS.setString("UID", request->getParam("UID")->value());
          NVS.setString("Token", request->getParam("Token")->value());
          eepromread();
          message = "{\"ver\":\"" + ver + "\",\"ssid\":\"" + ssid + "\",\"pass\":\"" + pass  + "\",\"UID\":\"" + UID + "\",\"WiFistatus\":\"" + WiFi.status() + "\",\"model\":\"" + model + "\",\"UUID\":\"" + chipId + "\",\"SketchSize\":\"" + ESP.getSketchSize() + "\",\"SdkVersion\":\"" + ESP.getSdkVersion() + "\", \"MinFreeHeap\":\"" + ESP.getMinFreeHeap() + "\",\"MaxAllocHeap\":\"" + ESP.getMaxAllocHeap() + "\",\"HeapSize\":\"" + ESP.getHeapSize() + "\",\"FreeSketchSpace\":\"" + ESP.getFreeSketchSpace() + "\",\"FreeHeap\":\"" + ESP.getFreeHeap() + "\",\"CpuFreqMHz\":\"" + ESP.getCpuFreqMHz() + "\", \"ChipRevision\":\"" + ESP.getChipRevision() + "\",\"localIP\":\"" + WiFi.localIP().toString() + "\",\"macAddress\":\"" + WiFi.macAddress() + "\",\"function\":\"" + "service" + "\"}";
          request->send(200, "text/plain", message);
          delay(1000);
          ESP.restart();
        } else if (function == "info") {
          message = "{\"ver\":\"" + ver + "\",\"ssid\":\"" + ssid + "\",\"pass\":\"" + pass  + "\",\"UID\":\"" + UID + "\",\"WiFistatus\":\"" + WiFi.status() + "\",\"model\":\"" + model + "\",\"UUID\":\"" + chipId + "\",\"SketchSize\":\"" + ESP.getSketchSize() + "\",\"SdkVersion\":\"" + ESP.getSdkVersion() + "\", \"MinFreeHeap\":\"" + ESP.getMinFreeHeap() + "\",\"MaxAllocHeap\":\"" + ESP.getMaxAllocHeap() + "\",\"HeapSize\":\"" + ESP.getHeapSize() + "\",\"FreeSketchSpace\":\"" + ESP.getFreeSketchSpace() + "\",\"FreeHeap\":\"" + ESP.getFreeHeap() + "\",\"CpuFreqMHz\":\"" + ESP.getCpuFreqMHz() + "\", \"ChipRevision\":\"" + ESP.getChipRevision() + "\",\"localIP\":\"" + WiFi.localIP().toString() + "\",\"macAddress\":\"" + WiFi.macAddress() + "\",\"function\":\"" + "service" + "\"}";
          request->send(200, "text/plain", message);
        }
      }
    });
    server.begin();
    while (true) {
      digitalWrite(LED_BUILTIN, HIGH);
      delay(50);
      digitalWrite(LED_BUILTIN, LOW);
      delay(50);
      digitalWrite(LED_BUILTIN, HIGH);
      delay(50);
      digitalWrite(LED_BUILTIN, LOW);
      delay(100);
    }
  }
  esp_task_wdt_init(10, true);
  esp_task_wdt_add(NULL);
  Time = millis();
}

void loop() {
  if (start == 0) {
    epochTime = getTime();
    if (epochTime != 0) {
      display.clearDisplay();
      display.display();
      start = 1;
      TIME = epochTime;
    }
  }
  if (digitalRead(0) == LOW) {
    reset();
  }
  Data();
  if (RDTS.available()) {
    RDTS.poll();
  } else {
    if (!RDTS.RDTSconnect()) {
      Server();
    } else {
      RDTS.send(json_string);
    }
  }
  if (WiFiMulti.run() != WL_CONNECTED && ssid != "") {
    ESP.restart();
  }
  if (millis() - Time < 300000 && Time != 0) {
    RDTS.send(json_string);
  }
  esp_task_wdt_reset();
}
