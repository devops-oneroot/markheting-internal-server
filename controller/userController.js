import multer from "multer";
import User from "../model/user.model.js"; // Import your User model

const upload = multer({ dest: "uploads/" }); // Files will be stored in 'uploads/' folder

export const concentAdd = (req, res) => {
  console.log(req.file); // Logs file details
  res.send("Consent added");
};



export const findUserById = async (req, res) => {
  try {
    const { id } = req.params; // Get user ID from request params
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};