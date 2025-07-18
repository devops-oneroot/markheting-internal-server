import multer from "multer";

const storage = multer.memoryStorage(); // Store files in memory for Cloudinary upload
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, JPG, and PDF are allowed."
        ),
        false
      );
    }
  },
});

export default upload;
