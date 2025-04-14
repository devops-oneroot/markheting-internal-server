// routes/locationRoute.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/location/:pincode", async (req, res) => {
  const { pincode } = req.params;

  try {
    const response = await fetch(`http://ec2-43-204-114-19.ap-south-1.compute.amazonaws.com:8001/locations/${pincode}`);
    const data = await response.json();
   
  
    
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
