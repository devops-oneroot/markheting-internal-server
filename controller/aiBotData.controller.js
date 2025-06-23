// controllers/aibot.controller.js
import aibotData from "../model/aibotData.model.js";
import User from "../model/user.model.js";

// Create new record in aibotData using user info or fallback to request body
export const createUser = async (req, res) => {
  const { number, name: inputName, tag: inputTag, crop: inputCrop, next_harvest_date: inputDate, no_of_trees: inputTrees } = req.body;

  if (!number) {
    return res.status(400).json({ message: "Number is required" });
  }

  try {
    const user = await User.findOne({ number });

    const name = user?.name || inputName || "";
    const tag = user?.tag || inputTag || "";
    const crop = user?.crop || inputCrop || "";
    const next_harvest_date = user?.next_harvest_date || inputDate || null;
    const no_of_trees = user?.no_of_trees || inputTrees || 0;

    const newRecord = new aibotData({
      number,
      name,
      tag,
      crop,
      next_harvest_date,
      no_of_trees,
    });

    const saved = await newRecord.save();

    res.status(201).json({
      message: "Data created successfully",
      data: saved,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Fetch user info from User model by number
export const userbynumber = async (req, res) => {
  const { number } = req.query;

  if (!number) {
    return res.status(400).json({ message: "Number is required" });
  }

  try {
    const user = await User.findOne({ number });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const response = {
      number: user.number,
      tag: user.tag || "",
      crop: user.crop || "",
      next_harvest_date: user.next_harvest_date || null,
      no_of_trees: user.no_of_trees || 0,
    };

    if (user.name) {
      response.name = user.name;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



export const getUser = async(req,res) => {

  const data = await aibotData.find()
  res.status(200).json({data})

}

export const deleteUser = async (req, res) => {
  try {
    const { number } = req.query;

    if (!number) {
      return res.status(400).json({ message: "Number is required" });
    }

    const user = await aibotData.findOneAndDelete({ number });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully", user });
  } catch (error) {
    console.error("Delete Error:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

