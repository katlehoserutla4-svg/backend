import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = decoded;
    return next();
  } catch (err) {
    console.error("Token verification failed:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function authorizeRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    if (req.user.role !== role) return res.status(403).json({ message: "Forbidden: insufficient role" });
    return next();
  };
}
