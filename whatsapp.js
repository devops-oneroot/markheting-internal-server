import * as dotenv from "dotenv";
import fetch from "node-fetch";
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

export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode = "en_US",
  imageLink,
}) {
  const url = "https://graph.facebook.com/v22.0/447851115073925/messages";
  const accessToken = process.env.MARKHET_WHATSAPP_ACCESS_TOKEN;

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: imageLink
        ? [
            {
              type: "header",
              parameters: [{ type: "image", image: { link: imageLink } }],
            },
          ]
        : undefined,
    },
  };

  try {
    const response = await limiter.schedule(() =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
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
    console.log("WhatsApp message sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw error;
  }
}

export default sendWhatsAppTemplateMessage;
