#include <SPI.h>
#include <MFRC522.h>
#include <HX711_ADC.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Pin definitions ---
#define RST_PIN     16
#define SS_PIN      5
#define HX711_DT    4
#define HX711_SCK   2
#define BUTTON_PIN  0

// --- OLED ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// --- Peripherals ---
MFRC522 rfid(SS_PIN, RST_PIN);
HX711_ADC loadCell(HX711_DT, HX711_SCK);

// --- WiFi & server ---
const char* ssid     = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const String serverURL = "http://192.168.1.100:8000";

// --- Load cell calibration ---
const float calibrationValue = 203.0;

// --- State machine ---
enum State { WAIT_RECIPE, BREWING, COMPLETE };
State state = WAIT_RECIPE;

// --- Brew session ---
int   currentStep  = 0;
float targetWeight = 0.0;
String currentRecipeId = "";

// --- Button debounce ---
unsigned long lastButtonPress = 0;
const unsigned long DEBOUNCE_MS = 300;

// --- Weight polling ---
unsigned long lastWeightSend = 0;
const unsigned long WEIGHT_INTERVAL_MS = 500;

// -------------------------------------------------------

void showOLED(const String& line1, const String& line2 = "", const String& line3 = "") {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(line1);
  if (line2.length() > 0) {
    display.setCursor(0, 16);
    display.println(line2);
  }
  if (line3.length() > 0) {
    display.setCursor(0, 32);
    display.println(line3);
  }
  display.display();
}

void setBrightness(uint8_t level) {
  display.ssd1306_command(SSD1306_SETCONTRAST);
  display.ssd1306_command(level);
}

String translit(const String& s) {
  // Return ASCII-safe version; Latin strings pass through unchanged.
  String out = "";
  for (unsigned int i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c >= 0x20 && c < 0x7F) out += c;
  }
  return out;
}

// -------------------------------------------------------

String httpGet(const String& path) {
  HTTPClient http;
  http.begin(serverURL + path);
  int code = http.GET();
  String body = (code > 0) ? http.getString() : "";
  http.end();
  return body;
}

String httpPost(const String& path, const String& payload) {
  HTTPClient http;
  http.begin(serverURL + path);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);
  String body = (code > 0) ? http.getString() : "";
  http.end();
  return body;
}

// Returns HTTP status code; body written to outBody.
int httpPostWithCode(const String& path, const String& payload, String& outBody) {
  HTTPClient http;
  http.begin(serverURL + path);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);
  outBody = (code > 0) ? http.getString() : "";
  http.end();
  return code;
}

// -------------------------------------------------------

void handleRFID() {
  if (WiFi.status() != WL_CONNECTED) {
    showOLED("No WiFi", "Check", "connection");
    return;
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  rfid.PICC_HaltA();

  StaticJsonDocument<64> req;
  req["uid"] = uid;
  String payload;
  serializeJson(req, payload);

  String resp;
  int code = httpPostWithCode("/recipe/select/", payload, resp);

  if (code == 404) {
    showOLED("Unknown", "card", "try again");
    delay(2000);
    showOLED("Scan card", "to select", "recipe");
    return;
  }

  if (code <= 0 || resp.length() == 0) {
    showOLED("Server error");
    return;
  }

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, resp) != DeserializationError::Ok) {
    showOLED("Parse error");
    return;
  }

  String recipeName = doc["name"] | "";
  String firstStep  = doc["first_step"] | "";

  currentRecipeId = doc["id"] | "";
  currentStep     = 0;
  targetWeight    = 0.0;

  showOLED(translit(recipeName), "Step 1", translit(firstStep));

  fetchStep();
  state = BREWING;
}

void fetchStep() {
  String resp = httpGet("/api/session");
  if (resp.length() == 0) return;

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, resp) != DeserializationError::Ok) return;

  JsonObject step = doc["current_step"];
  if (step.isNull()) {
    state = COMPLETE;
    return;
  }

  targetWeight    = step["target_weight_g"] | 0.0f;
  String stepName = step["name"] | "";
  String instr    = step["instruction"] | "";

  showOLED(translit(stepName), translit(instr));
}

void sendWeight(float w) {
  StaticJsonDocument<64> req;
  req["weight"] = w;
  String payload;
  serializeJson(req, payload);
  httpPost("/api/weight", payload);
}

void confirmWeight(float w) {
  StaticJsonDocument<64> req;
  req["weight"] = w;
  String payload;
  serializeJson(req, payload);
  httpPost("/api/weight/confirm", payload);
}

void completeStep() {
  httpPost("/api/brew/step", "{}");
  currentStep++;
  fetchStep();
}

void completeBrew() {
  httpPost("/api/brew/complete", "{}");
  state = COMPLETE;
  showOLED("Brew complete!", "Enjoy your cup");
}

// -------------------------------------------------------

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  Wire.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED init failed");
    while (true);
  }
  setBrightness(128);
  showOLED("Connecting...");

  SPI.begin();
  rfid.PCD_Init();

  loadCell.begin();
  loadCell.start(2000, true);
  loadCell.setCalFactor(calibrationValue);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());

  showOLED("Scan card", "to select", "recipe");
}

// -------------------------------------------------------

void loop() {
  loadCell.update();

  switch (state) {
    case WAIT_RECIPE:
      handleRFID();
      break;

    case BREWING: {
      float weight = loadCell.getData();

      // Periodically push weight to server
      if (millis() - lastWeightSend >= WEIGHT_INTERVAL_MS) {
        lastWeightSend = millis();
        sendWeight(weight);
      }

      // Button press = confirm step target reached
      if (digitalRead(BUTTON_PIN) == LOW && millis() - lastButtonPress > DEBOUNCE_MS) {
        lastButtonPress = millis();
        confirmWeight(weight);

        // Check if this was the last step
        String resp = httpGet("/api/session");
        StaticJsonDocument<512> doc;
        if (deserializeJson(doc, resp) == DeserializationError::Ok) {
          bool active = doc["active"] | true;
          if (!active || doc["current_step"].isNull()) {
            completeBrew();
          } else {
            completeStep();
          }
        }
      }
      break;
    }

    case COMPLETE:
      // Wait for new RFID scan to start fresh session
      if (rfid.PICC_IsNewCardPresent()) {
        state = WAIT_RECIPE;
        showOLED("Scan card", "to select", "recipe");
      }
      break;
  }

  delay(50);
}
