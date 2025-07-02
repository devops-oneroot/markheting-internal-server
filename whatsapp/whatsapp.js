import * as dotenv from "dotenv";
import fetch from "node-fetch"; // For Node.js versions earlier than 18; Node 18+ has built-in fetch
import https from "https";
import Bottleneck from "bottleneck";

dotenv.config();

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
});

const limiter = new Bottleneck({
  maxConcurrent: 100,
  minTime: 10,
});

export async function createUserAndSendFlow({
  phone,
  flowId = "1741784066803",
  type = "broadcast" | "call link" | "IVR",
}) {
  // Remove any double quotes and leading zero from the phone number
  let sanitizedPhone = phone.replace(/"/g, "").trim();
  if (sanitizedPhone.startsWith("0")) {
    sanitizedPhone = sanitizedPhone.substring(1);
  }

  const endpoint = process.env.CHATRACE_SEND_API_URL;

  console.log("Sanitized Phone:", sanitizedPhone);

  const payload = {
    phone: sanitizedPhone,
    first_name: sanitizedPhone,
    last_name: type,
    gender: "male",
    actions: [
      {
        action: "send_flow",
        flow_id: flowId,
      },
    ],
  };

  try {
    const response = await limiter.schedule(() =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "X-ACCESS-TOKEN": process.env.CHATRACE_API_KEY,
        },
        body: JSON.stringify(payload),
        agent,
      })
    );

    const data = await response.json();
    if (!response.ok) {
      console.error(`Error ${response.status}:`, data);
      return data;
    }
    console.log("User created and flow sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error creating user and sending flow:", error);
    throw error;
  }
}

export async function sendUpdateFlow({ phone }) {
  let sanitizedPhone = phone.replace(/"/g, "").trim();
  if (sanitizedPhone.startsWith("0")) {
    sanitizedPhone = sanitizedPhone.substring(1);
  }

  const endpoint = process.env.CHATRACE_SEND_API_URL;

  console.log("Sanitized Phone:", sanitizedPhone);
  try {
    const response = await limiter.schedule(() =>
      fetch(`${endpoint}/${phone}/send/1746687279543`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "X-ACCESS-TOKEN": process.env.CHATRACE_API_KEY,
        },
        agent,
      })
    );

    const data = await response.json();
    if (!response.ok) {
      console.error(`Error ${response.status}:`, data);
      return data;
    }
    console.log("User created and flow sent successfully:", data);
    return data;
  } catch (error) {}
}
