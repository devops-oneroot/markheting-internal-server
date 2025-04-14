// routes/locationRoute.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/location/:pincode", async (req, res) => {
  const { pincode } = req.params;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_LOCATION_API}/locations/${pincode}`);

    const data = await response.json();
    console.log(data)
   
  
    
    if (!data) {
      return res.status(404).json({ error: "Invalid pincode or data not found" });
    }
    

    const locations = data.data.map(location => ({
      village:location.village,
      taluk: location.taluk,
      district: location.district
    }));
    
    res.json({ data: locations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router; // ✅ ES module export
