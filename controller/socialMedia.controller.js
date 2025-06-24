import User from "../model/user.model.js";
import webhookQueue from "../queues/webhookQueues.js";

export const facebookbotWebhook = async (req, res) => {
  webhookQueue
    .add(async () => {
      const { label } = req.params;
      const { first_name, phone, custom_fields } = req.body;

      const identityField = custom_fields.find(
        (item) => item.name === "Identity"
      );
      if (identityField) {
        console.log("🔍 Identity field value:", identityField.value);
      }

      try {
        const existingUser = await User.findOne({
          number: phone,
        });

        if (existingUser) {
          console.log("ℹ️ User already exists");
          return;
        }

        await User.create({
          number: phone,
          name: first_name,
          identity: identityField.value,
          tag: label,
          consent: "yes",
          consent_date: Date.name(),
        });

        console.log("✅ User created from webhook");
      } catch (error) {
        console.error("❌ Error in facebookbotWebhook:", error.message);
      }
    })
    .catch((err) => {
      console.error("❌ Queue error:", err);
    });
};
