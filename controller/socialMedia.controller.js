import SocialMediaMarketing from "../model/socail_marketing.model.js";
import webhookQueue from "../queues/webhookQueues.js";

export const facebookbotWebhook = async (req, res) => {
  webhookQueue
    .add(async () => {
      const { label } = req.params;
      const { id, full_name, phone } = req.body;
      console.log(id, full_name, phone, label);

      try {
        const existingUser = await SocialMediaMarketing.findOne({
          contact_id: id,
        });
        if (existingUser) {
          console.log("ℹ️ User already exists");
          return;
        }

        await SocialMediaMarketing.create({
          contact_id: id,
          contactedAt: new Date(),
          label,
          name: full_name,
          phone,
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
