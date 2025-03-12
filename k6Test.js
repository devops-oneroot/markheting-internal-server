import http from "k6/http";
import { check, sleep } from "k6";

export let options = {
  stages: [
    { duration: "10s", target: 100 }, // Ramp up to 100 users in 10s
    { duration: "20s", target: 1000 }, // Stay at 1000 users for 20s
    { duration: "10s", target: 0 }, // Ramp down to 0 users in 10s
  ],
};

export default function () {
  const url = "http://localhost:3000/webhook";
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const randomPhone = "7204408035";
  const callFrom = "0" + randomPhone; // Simulating incoming call number

  const res = http.get(`${url}?CallFrom=${callFrom}`, params);

  // Log the response details (useful for debugging)
  console.log(`Status: ${res.status} | Body: ${res.body}`);

  // Add a check for an expected part of the response.
  check(res, {
    "is status 202": (r) => r.status === 202, // if you are using the async fire-and-forget pattern
    "body contains expected message": (r) =>
      r.body.includes("Webhook processed"),
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1); // Delay to simulate realistic traffic
}
