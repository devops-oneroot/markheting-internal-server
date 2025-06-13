import jwt from "jsonwebtoken";

export const verifyMiddlewareToken = (req, res, next) => {
  const authHeader =
    req.headers["authorization"] || req.headers["x-authorization"];
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.role = decoded.role;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};
