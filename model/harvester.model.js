import mongoose from "mongoose";

const harvesterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v); // Validates 10-digit phone number
        },
        message: (props) =>
          `${props.value} is not a valid 10-digit phone number!`,
      },
    },
    village: {
      type: String,

      trim: true,
    },
    hobli: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
    taluk: {
      type: String,
      required: true,
      trim: true,
    },
    is_owner: {
      type: Boolean,
      required: true,
    },
    workers_count: {
      type: Number,
      required: true,
      min: [0, "Number of workers cannot be negative"],
    },
    has_pickup: {
      type: Boolean,
      required: true,
    },
    // markets: {
    //   type: [String],
    //   required: true,
    //   validate: {
    //     validator: function (v) {
    //       return v.length > 0; // Ensure at least one market is selected
    //     },
    //     message: "At least one market must be specified",
    //   },
    // },
    main_markets: {
      type: [String],
      required: true,
      // validate: {
      //   validator: function (v) {
      //     return v.length > 0 && v.length <= 10; // Limit to 10 main markets
      //   },
      //   message: "Main markets must be between 1 and 3",
      // },
    },
    secondary_markets: {
      type: [String],
      default: [],
    },
    harvest_areas: {
      type: [String],
      required: true,
    },
    max_distance_km: {
      type: Number,

      min: [0, "Maximum distance cannot be negative"],
    },
    min_quantity_required: {
      type: Number,
      required: true,
      min: [0, "Minimum quantity cannot be negative"],
    },
    min_daily_target_nuts: {
      type: Number,
      required: true,
      min: [0, "Minimum daily target cannot be negative"],
    },
    price_per_nut: {
      type: Number,
      required: true,
      min: [0, "Price per nut cannot be negative"],
    },
    nut_type: {
      type: String,
      required: true,
      // enum: ["Mixed", "Only Filtered", "Both"],
    },
    other_crops: {
      type: [String],
    },
    harvests_in_winter: {
      type: Boolean,
      required: true,
    },
    taken_advance: {
      type: Boolean,
      required: true,
    },
    ready_to_supply: {
      type: String,
      required: true,
    },
    aadhaar_card_url: {
      type: String,
      // URL of the Aadhaar card stored in Cloudinary
    },
    aadhaar_card_public_id: {
      type: String, // Public ID for managing the Aadhaar card in Cloudinary
    },
    photo_url: {
      type: String,
      // URL of the photo stored in Cloudinary
    },
    photo_public_id: {
      type: String, // Public ID for managing the photo in Cloudinary
    },
    bank_account: {
      type: String,
    },
    Buyer_notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Harvester = mongoose.model("Harvester", harvesterSchema);

export default Harvester;
