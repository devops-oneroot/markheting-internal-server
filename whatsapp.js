import * as dotenv from "dotenv";
dotenv.config();

export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode = "en_US",
  imageLink, // URL for the header image; required if your template expects an image header
}) {
  // The endpoint URL with your provided Phone Number ID
  const url = "https://graph.facebook.com/v22.0/189810287560171/messages";
  // Use your long-lived access token from environment variables
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  // Build the payload
  const payload = {
    messaging_product: "whatsapp",
    to: to, // The recipient's phone number in international format
    type: "template",
    template: {
      name: templateName, // Must exactly match the approved template name
      language: {
        code: languageCode,
      },
      // Include header component if imageLink is provided
      components: imageLink
        ? [
            {
              type: "header",
              parameters: [
                {
                  type: "image",
                  image: {
                    link: imageLink,
                  },
                },
              ],
            },
          ]
        : undefined,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

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
