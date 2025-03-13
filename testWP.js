import fetch from "node-fetch";

async function sendWhatsAppTemplateMessage(
  to,
  templateName,
  languageCode,
  imageUrl
) {
  const url = "https://graph.facebook.com/v22.0/447851115073925/messages";
  const token =
    "EAAPriJOVzGIBO0h5VPK2PyPSf7iSX3DyBGysBMsO4tSNeedhEPV8SctjO2sfW2yWhLS47kXw2AMLUCvzqGaDHuyBeKZCRZA6vjnjYzoHqp8R7ZAiZBUqsARwGebHA8vA4mjVz7zoVxbGKmpaFZAtxSfzuvTc4Eu8gEZCNAC0749G8fAxLmTljZCkKoEnu1CFaNcyqlZAZBms6pYj2i2Kv8S3LnuAzc0OY"; // Replace with your actual token

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: { link: imageUrl }, // Provide the correct image URL
            },
          ],
        },
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// Example usage
sendWhatsAppTemplateMessage(
  "917204408035",
  "missed_call_initial_message_ready",
  "kn",
  "https://i.imgur.com/XLYYiUz.jpeg" // Replace with a valid image URL
);
