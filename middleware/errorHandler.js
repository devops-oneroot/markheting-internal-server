const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Multer error: ${err.message}` });
  } else if (err.message.includes("Invalid file type")) {
    return res.status(400).json({ message: err.message });
  } else if (err.name === "ValidationError") {
    return res
      .status(400)
      .json({ message: `Validation error: ${err.message}` });
  } else if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID format" });
  } else {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export default errorHandler;
