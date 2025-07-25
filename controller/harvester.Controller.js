import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import Harvester from "../model/harvester.model.js";

dotenv.config();

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

// Helper function to upload a file to Cloudflare R2
const uploadToR2 = (file, folder) => {
  return new Promise(async (resolve, reject) => {
    try {
      const key = `${folder}/${Date.now()}_${file.originalname}`;
      const params = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      // Construct the public URL with bucket name
      const url = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${process.env.CLOUDFLARE_R2_BUCKET}/${key}`;
      console.log(`Uploaded file to R2: ${url}`);
      resolve({ url, public_id: key });
    } catch (error) {
      console.error("Error uploading to Cloudflare R2:", error);
      reject(new Error("Error uploading to Cloudflare R2: " + error.message));
    }
  });
};

export const createHarvester = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      village,
      hobli,
      district,
      taluk,
      is_owner,
      workers_count,
      has_pickup,
      main_markets,
      secondary_markets,
      harvest_areas,
      max_distance_km,
      min_quantity_required,
      min_daily_target_nuts,
      price_per_nut,
      nut_type,
      other_crops,
      harvests_in_winter,
      taken_advance,
      ready_to_supply,
      Buyer_notes,
      bank_account,
    } = req.body;

    // Validate required field: phone
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Parse JSON strings for array fields
    const parsedMainMarkets =
      typeof main_markets === "string"
        ? JSON.parse(main_markets)
        : main_markets || [];
    const parsedSecondaryMarkets =
      typeof secondary_markets === "string"
        ? JSON.parse(secondary_markets)
        : secondary_markets || [];
    const parsedHarvestAreas =
      typeof harvest_areas === "string"
        ? JSON.parse(harvest_areas)
        : harvest_areas || [];
    const parsedOtherCrops =
      typeof other_crops === "string"
        ? JSON.parse(other_crops)
        : other_crops || [];

    // Check if phone number already exists
    const existingHarvester = await Harvester.findOne({ phone });
    if (existingHarvester) {
      return res.status(409).json({ message: "Phone number already exists" });
    }

    // Upload Aadhaar card and photo to Cloudflare R2 if provided
    let aadhaarUpload = {};
    let photoUpload = {};

    if (req.files?.aadhaar_card) {
      aadhaarUpload = await uploadToR2(
        req.files.aadhaar_card[0],
        "harvesters/aadhaar"
      );
    }

    if (req.files?.photo) {
      photoUpload = await uploadToR2(req.files.photo[0], "harvesters/photos");
    }

    const harvester = await Harvester.create({
      name,
      phone,
      village,
      hobli,
      district,
      taluk,
      is_owner: is_owner === "true" || is_owner === true,
      workers_count: workers_count ? Number(workers_count) : undefined,
      has_pickup: has_pickup === "true" || has_pickup === true,
      main_markets: parsedMainMarkets,
      secondary_markets: parsedSecondaryMarkets,
      harvest_areas: parsedHarvestAreas,
      max_distance_km: max_distance_km ? Number(max_distance_km) : undefined,
      min_quantity_required: min_quantity_required
        ? Number(min_quantity_required)
        : undefined,
      min_daily_target_nuts: min_daily_target_nuts
        ? Number(min_daily_target_nuts)
        : undefined,
      price_per_nut: price_per_nut ? Number(price_per_nut) : undefined,
      nut_type,
      other_crops: parsedOtherCrops,
      harvests_in_winter:
        harvests_in_winter === "true" || harvests_in_winter === true,
      taken_advance: taken_advance === "true" || taken_advance === true,
      ready_to_supply,
      Buyer_notes,
      bank_account,
      aadhaar_card_url: aadhaarUpload.url,
      aadhaar_card_public_id: aadhaarUpload.public_id,
      photo_url: photoUpload.url,
      photo_public_id: photoUpload.public_id,
    });

    return res.status(201).json(harvester);
  } catch (err) {
    console.error("Error creating harvester:", err);
    next(err);
  }
};

export const getAllHarvesters = async (req, res, next) => {
  try {
    const harvesters = await Harvester.find();
    return res.status(200).json(harvesters);
  } catch (err) {
    console.error("Error fetching harvesters:", err);
    next(err);
  }
};

export const getHarvesterById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const harvester = await Harvester.findById(id);
    if (!harvester) {
      return res.status(404).json({ message: "Harvester not found" });
    }
    return res.status(200).json(harvester);
  } catch (err) {
    console.error("Error fetching harvester by ID:", err);
    next(err);
  }
};

export const updateHarvester = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      village,
      hobli,
      district,
      taluk,
      is_owner,
      workers_count,
      has_pickup,
      main_markets,
      secondary_markets,
      harvest_areas,
      max_distance_km,
      min_quantity_required,
      min_daily_target_nuts,
      price_per_nut,
      nut_type,
      other_crops,
      harvests_in_winter,
      taken_advance,
      ready_to_supply,
      Buyer_notes,
      bank_account,
    } = req.body;

    const parsedMainMarkets =
      typeof main_markets === "string"
        ? JSON.parse(main_markets)
        : main_markets || [];
    const parsedSecondaryMarkets =
      typeof secondary_markets === "string"
        ? JSON.parse(secondary_markets)
        : secondary_markets || [];
    const parsedHarvestAreas =
      typeof harvest_areas === "string"
        ? JSON.parse(harvest_areas)
        : harvest_areas || [];
    const parsedOtherCrops =
      typeof other_crops === "string"
        ? JSON.parse(other_crops)
        : other_crops || [];

    const updateData = {
      name,
      phone,
      village,
      hobli,
      district,
      taluk,
      is_owner: is_owner === "true" || is_owner === true,
      workers_count: workers_count ? Number(workers_count) : undefined,
      has_pickup: has_pickup === "true" || has_pickup === true,
      main_markets: parsedMainMarkets,
      secondary_markets: parsedSecondaryMarkets,
      harvest_areas: parsedHarvestAreas,
      max_distance_km: max_distance_km ? Number(max_distance_km) : undefined,
      min_quantity_required: min_quantity_required
        ? Number(min_quantity_required)
        : undefined,
      min_daily_target_nuts: min_daily_target_nuts
        ? Number(min_daily_target_nuts)
        : undefined,
      price_per_nut: price_per_nut ? Number(price_per_nut) : undefined,
      nut_type,
      other_crops: parsedOtherCrops,
      harvests_in_winter:
        harvests_in_winter === "true" || harvests_in_winter === true,
      taken_advance: taken_advance === "true" || taken_advance === true,
      ready_to_supply,
      Buyer_notes,
      bank_account,
    };

    if (req.files?.aadhaar_card) {
      const aadhaarUpload = await uploadToR2(
        req.files.aadhaar_card[0],
        "harvesters/aadhaar"
      );
      updateData.aadhaar_card_url = aadhaarUpload.url;
      updateData.aadhaar_card_public_id = aadhaarUpload.public_id;
    }

    if (req.files?.photo) {
      const photoUpload = await uploadToR2(
        req.files.photo[0],
        "harvesters/photos"
      );
      updateData.photo_url = photoUpload.url;
      updateData.photo_public_id = photoUpload.public_id;
    }

    const harvester = await Harvester.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!harvester) {
      return res.status(404).json({ message: "Harvester not found" });
    }

    return res.status(200).json(harvester);
  } catch (err) {
    console.error("Error updating harvester:", err);
    next(err);
  }
};

export const deleteHarvester = async (req, res, next) => {
  try {
    const { id } = req.params;
    const harvester = await Harvester.findByIdAndDelete(id);
    if (!harvester) {
      return res.status(404).json({ message: "Harvester not found" });
    }

    // Optionally, delete files from Cloudflare R2
    if (harvester.aadhaar_card_public_id) {
      const command = new DeleteObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: harvester.aadhaar_card_public_id,
      });
      await s3Client.send(command);
    }
    if (harvester.photo_public_id) {
      const command = new DeleteObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: harvester.photo_public_id,
      });
      await s3Client.send(command);
    }

    return res.status(200).json({ message: "Harvester deleted successfully" });
  } catch (err) {
    console.error("Error deleting harvester:", err);
    next(err);
  }
};
