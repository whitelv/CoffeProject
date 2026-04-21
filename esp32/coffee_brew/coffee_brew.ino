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
String currentRecipeId = "";
String currentStepName = "";
float  targetWeight    = 0.0;

// --- Brewing timers ---
unsigned long lastWeightRead    = 0;
unsigned long lastWeightStream  = 0;
unsigned long lastOledUpdate    = 0;
unsigned long lastStepPoll      = 0;
unsigned long lastStabilityCheck = 0;

const unsigned long WEIGHT_READ_MS      = 200;
const unsigned long WEIGHT_STREAM_MS    = 400;
const unsigned long OLED_UPDATE_MS      = 200;
const unsigned long STEP_POLL_MS        = 2000;
const unsigned long STABILITY_CHECK_MS  = 120;

// --- Weight state ---
float currentWeight  = 0.0;
float prevWeight     = -999.0;
bool  justConfirmed  = false;
unsigned long confirmedAt = 0;

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

  String recipeName   = doc["name"] | "";
  String firstStep    = doc["first_step"] | "";
  currentRecipeId     = doc["id"] | "";
  currentStepName     = firstStep;
  targetWeight        = 0.0;
  currentWeight       = 0.0;
  prevWeight          = -999.0;
  justConfirmed       = false;

  showOLED(translit(recipeName), "Step 1", translit(firstStep));

  // Reset all brewing timers
  unsigned long now = millis();
  lastWeightRead     = now;
  lastWeightStream   = now;
  lastOledUpdate     = now;
  lastStepPoll       = now;
  lastStabilityCheck = now;

  state = BREWING;
}

// -------------------------------------------------------

void pollStep() {
  String resp = httpGet("/recipe/current/");
  if (resp.length() == 0) return;

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, resp) != DeserializationError::Ok) return;

  if (doc["complete"] | false) {
    state = COMPLETE;
    showOLED("Brew complete!", "Enjoy your", "coffee!");
    return;
  }

  currentStepName = doc["name"] | currentStepName;
  targetWeight    = doc["target_weight_g"] | targetWeight;
}

void streamWeight() {
  StaticJsonDocument<64> req;
  req["weight"] = currentWeight;
  String payload;
  serializeJson(req, payload);

  String resp = httpPost("/weight/current/", payload);
  if (resp.length() == 0) return;

  StaticJsonDocument<64> doc;
  if (deserializeJson(doc, resp) != DeserializationError::Ok) return;

  if (!(doc["active"] | true)) {
    state = WAIT_RECIPE;
    showOLED("Scan card", "to select", "recipe");
  }
}

void checkStability() {
  if (abs(currentWeight - prevWeight) <= 2.0 &&
      abs(currentWeight - targetWeight) <= 5.0 &&
      targetWeight > 0.0) {

    StaticJsonDocument<64> req;
    req["weight"] = currentWeight;
    String payload;
    serializeJson(req, payload);
    httpPost("/weight/confirmed/", payload);

    justConfirmed = true;
    confirmedAt   = millis();
    showOLED(translit(currentStepName), "Confirmed!", "");
  }
  prevWeight = currentWeight;
}

void updateBrewingOLED() {
  if (justConfirmed) return; // confirmation message shown — don't overwrite yet

  String weightLine = String(currentWeight, 1) + "g / " + String(targetWeight, 1) + "g";
  String stable     = (abs(currentWeight - prevWeight) <= 2.0) ? "stable" : "pouring";
  showOLED(translit(currentStepName), weightLine, stable);
}

// -------------------------------------------------------

void setup() {
  Serial.begin(115200);

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
  unsigned long now = millis();

  switch (state) {
    case WAIT_RECIPE:
      handleRFID();
      break;

    case BREWING: {
      // Clear confirmed message after 1500ms
      if (justConfirmed && now - confirmedAt >= 1500) {
        justConfirmed = false;
      }

      // Weight read (200ms)
      if (now - lastWeightRead >= WEIGHT_READ_MS) {
        lastWeightRead = now;
        float raw = loadCell.getData();
        currentWeight = max(0.0f, raw);
      }

      // Stability check (120ms)
      if (now - lastStabilityCheck >= STABILITY_CHECK_MS) {
        lastStabilityCheck = now;
        if (!justConfirmed) checkStability();
      }

      // OLED update (200ms)
      if (now - lastOledUpdate >= OLED_UPDATE_MS) {
        lastOledUpdate = now;
        updateBrewingOLED();
      }

      // Weight stream to server (400ms)
      if (now - lastWeightStream >= WEIGHT_STREAM_MS) {
        lastWeightStream = now;
        streamWeight();
      }

      // Step poll (2000ms)
      if (now - lastStepPoll >= STEP_POLL_MS) {
        lastStepPoll = now;
        pollStep();
      }

      break;
    }

    case COMPLETE:
      if (rfid.PICC_IsNewCardPresent()) {
        state = WAIT_RECIPE;
        showOLED("Scan card", "to select", "recipe");
      }
      break;
  }

  delay(50);
}
