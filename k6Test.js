import http from "k6/http";
import { check, sleep } from "k6";

export let options = {
  stages: [
    { duration: "10s", target: 100 }, // Ramp up to 100 VUs in 10s
    { duration: "20s", target: 1000 }, // Stay at 1000 VUs for 20s
    { duration: "10s", target: 0 }, // Ramp down to 0 over 10s
  ],
};

export default function () {
  const url = "http://localhost:3003/aibot/webhook";

  const payload = JSON.stringify({
    Date: "2025-05-20 20:17:03.267058+05:30",
    Format: "wav",
    From: "+918035738750",
    ProratedStorageCost: "e8684c8e-48db-4d81-aae9-19f16ee74d13",
    RecordingType: "call",
    RecordingURL:
      "https://media.plivo.com/v1/Account/MANDBHYTBKNMY1YWVIMM/Recording/e8684c8e-48db-4d81-aae9-19f16ee74d13.wav",
    To: "919880520824",
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  // Send POST with JSON body
  const res = http.post(url, payload, params);

  console.log(`Status: ${res.status} | Body: ${res.body}`);

  check(res, {
    "is status 200": (r) => r.status === 200,
    "body contains confirmation": (r) => r.body.includes("Webhook received"),
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
