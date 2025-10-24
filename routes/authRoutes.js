// backend/routes/authRoutes.js
import express from "express";
import db from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Find user by email (explicit columns)
    const [results] = await db.query(
      "SELECT id, name, email, password, role, created_at FROM users WHERE email = ?",
      [email]
    );
    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Create JWT
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "8h" });

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Register
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "Name, email, password and role are required" });
  }

  try {
    // Check if user exists
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashed, role]
    );

    const newUser = {
      id: result.insertId,
      name,
      email,
      role,
    };

    return res.status(201).json({ message: "User created", user: newUser });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// List users (optional query ?role=lecturer)
router.get('/', async (req, res) => {
  const { role } = req.query;
  try {
    if (role) {
      const [rows] = await db.query('SELECT id, name, email, role FROM users WHERE role = ? ORDER BY name ASC', [role]);
      return res.json(Array.isArray(rows) ? rows : []);
    }
    const [rows] = await db.query('SELECT id, name, email, role FROM users ORDER BY name ASC');
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

export default router;
