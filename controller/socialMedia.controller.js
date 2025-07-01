import User from "../model/user.model.js";
import webhookQueue from "../queues/webhookQueues.js";

export const facebookbotWebhook = async (req, res) => {
  res.status(200).send("OK");

  webhookQueue.add(async () => {
    const { label } = req.params;
    const { first_name, phone, custom_fields } = req.body;

    const identityField = custom_fields.find(
      (item) => item.name === "Identity"
    );

    if (identityField) {
      console.log("🔍 Identity field value:", identityField.value);
    }

    try {
      phone = phone.replace(/^(\+91|91)/, "").trim();

      const existingUser = await User.findOne({ number: phone });

      if (existingUser) {
        existingUser.identity = identityField?.value;
        existingUser.name = first_name;
        existingUser.tag = label;
        await existingUser.save();
        console.log("🔄 Existing user updated:", phone);
        return;
      }

      await User.create({
        number: phone,
        name: first_name,
        identity: identityField?.value,
        consent: "yes",
        consent_date: new Date(),
      });

      console.log("✅ User created from webhook");
    } catch (error) {
      console.error("❌ Error in facebookbotWebhook:", error.message);
    }
  });
};

export const contactCreatedWebhook = async (req, res) => {
  try {
    const { phone } = req.body;
    const { label } = req.params;

    if (!phone) {
      console.warn("⚠️ Phone not provided in webhook payload");
      return res
        .status(400)
        .json({ success: false, message: "Phone is required" });
    }

    // 🚫 Strip +91 or 91 from the beginning if present
    phone = phone.replace(/^(\+91|91)/, "").trim();

    res.status(200).json({ success: true, message: "Webhook received" });

    webhookQueue
      .add(async () => {
        try {
          console.log("📥 Processing contact from webhook:", phone);

          const existingUser = await User.findOne({ number: phone });

          if (existingUser) {
            console.log("ℹ️ User already exists:", phone);
            return;
          }

          await User.create({
            number: phone,
            identity: "Unknown",
            tag: label,
            consent: "yes",
            consent_date: new Date(),
          });

          console.log("✅ Contact created from webhook");
        } catch (error) {
          console.error("❌ Error processing contact webhook:", error.message);
        }
      })
      .catch((err) => {
        console.error("❌ Queue error in contactCreatedWebhook:", err);
      });
  } catch (error) {
    console.error("❌ Error in contactCreatedWebhook (outer):", error.message);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
};
