import mongoose from "mongoose";

const socialMediaMarketingSchema = new mongoose.Schema({
  contact_id: {
    type: String,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  contactedAt: {
    type: Date,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
});

const SocialMediaMarketing = mongoose.model(
  "SocialMediaMarketing",
  socialMediaMarketingSchema
);

export default SocialMediaMarketing;
