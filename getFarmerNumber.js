import axios from "axios";
import { Parser } from "json2csv";
import fs from "fs/promises";
import path from "path";

export async function generateFarmerMobileCsv(apiUrl, outputPath) {
  // 1. Fetch the farmer data
  const response = await axios.get(apiUrl);
  if (!response.data || !Array.isArray(response.data.data)) {
    throw new Error("Unexpected response format: data.data array missing");
  }
  const farmers = response.data.data;

  // 2. Extract mobile numbers
  const records = farmers.map((farmer) => ({
    mobileNumber: farmer.mobileNumber.startsWith("+91")
      ? farmer.mobileNumber.slice(3)
      : farmer.mobileNumber,
  }));

  // 3. Convert JSON to CSV
  const fields = ["mobileNumber"];
  const parser = new Parser({ fields });
  const csv = parser.parse(records);

  // 4. Write to file if path provided
  if (outputPath) {
    let targetPath = outputPath;
    try {
      const stats = await fs.stat(outputPath);
      if (stats.isDirectory()) {
        const defaultName = "farmer-mobile-numbers.csv";
        targetPath = path.join(outputPath, defaultName);
      }
    } catch (err) {
      // If stat fails, assume outputPath is intended as a file path
      // Ensure it has .csv extension
      if (path.extname(outputPath) === "") {
        targetPath = `${outputPath}.csv`;
      }
    }

    await fs.writeFile(targetPath, csv, "utf8");
    console.log(`CSV written to ${targetPath}`);
  }

  return csv;
}

generateFarmerMobileCsv(
  "https://markhet-internal.onrender.com/users/farmer",
  "generated-csv"
)
  .then(() => console.log("CSV generation successful."))
  .catch((err) => {
    console.error("Error generating CSV:", err.message);
    process.exit(1);
  });
