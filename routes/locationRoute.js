// // routes/locationRoute.js
// import express from "express";
// import fetch from "node-fetch";

// const router = express.Router();

// router.get("/location/:pincode", async (req, res) => {
//   const { pincode } = req.params;

//   const baseUrl = process.env.LOCATION_API;
//   if (!baseUrl) {
//     console.error("❌ LOCATION_API is not defined in environment variables");
//     return res.status(500).json({ error: "Server configuration error: LOCATION_API missing" });
//   }

//   try {
//     const response = await fetch(`${baseUrl}/locations/${pincode}`);
    
//     if (!response.ok) {
//       return res.status(response.status).json({ error: "Failed to fetch location data" });
//     }

//     const data = await response.json();
//     // console.log("📦 Raw location API response:", data);

//     if (!data || !data.data || !Array.isArray(data.data)) {
//       return res.status(404).json({ error: "Invalid pincode or data not found" });
//     }

//     const locations = data.data.map(location => ({
//       village: location.village,
//       taluk: location.taluk,
//       district: location.district
//     }));

//     res.json({ data: locations });
//   } catch (err) {
//     console.error("🔥 Error fetching location data:", err);
//     res.status(500).json({ error: "Something went wrong" });
//   }
// });

// export default router;
