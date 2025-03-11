async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode = "en_US",
}) {
  // The endpoint URL is updated with your provided Phone Number ID
  const url = "https://graph.facebook.com/v22.0/189810287560171/messages";
  // Replace with your actual access token; consider storing it securely (e.g., in an environment variable)
  const accessToken =
    "EAAxAu3HxwgMBO3ei2oYPgq4zz6NiylroVyZBmxfa8gimtZBqAiUnSyRFZC1bVN0xoXoXZBsNXaQBdsOZAfyMYUZCOoK4qlpAPqgSWWcq1Ius9ZBvvTyGP9CPeSZAjs9zpWH6dnjk1ZB8AGMWIYqxQmbKP3nhCMwkVbS8Q6X4EcbG2g52Fs1N4zSX0Hib7a13PWewiCOguUJjFsu6bVwqghr5U2wErBiUZD";

  const payload = {
    messaging_product: "whatsapp",
    to: to, // The recipient's phone number (in international format)
    type: "template",
    template: {
      name: templateName, // For example: "hello_world"
      language: {
        code: languageCode,
      },
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
