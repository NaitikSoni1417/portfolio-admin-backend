import jwt from "jsonwebtoken";

/**
 * Admin authorization middleware.
 * Moved verbatim out of server.js so the exact same implementation can be
 * exercised by tests without booting the whole application.
 */
export function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export default auth;
