// 📁 routes/coursesRoutes.js
import express from "express";
import db from "../db.js";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

/* ============================
   📘 GET ALL COURSES
============================ */
router.get("/", async (req, res) => {
  try {
    const [courses] = await db.query(`
      SELECT c.id, c.course_name, c.course_code, c.faculty_name, c.assigned_to, u.name AS lecturer_name
      FROM courses c
      LEFT JOIN users u ON c.assigned_to = u.id
      ORDER BY c.course_name ASC
    `);
    res.json(courses);
  } catch (err) {
    console.error("❌ Error fetching courses:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   ➕ ADD NEW COURSE
============================ */
router.post("/", authenticateToken, authorizeRole("pl"), async (req, res) => {
  const { course_name, course_code, faculty_name, assigned_to } = req.body;
  if (!course_name || !course_code || !faculty_name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO courses (course_name, course_code, faculty_name, assigned_to) VALUES (?, ?, ?, ?)",
      [course_name, course_code, faculty_name, assigned_to || null]
    );
    res.status(201).json({ message: "Course added", id: result.insertId });
  } catch (err) {
    console.error("❌ Error adding course:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   ✏ ASSIGN / CHANGE LECTURER
============================ */
router.put("/:id/assign", authenticateToken, authorizeRole("pl"), async (req, res) => {
  const { id } = req.params;
  const { lecturer_id } = req.body;

  if (!lecturer_id) return res.status(400).json({ message: "Lecturer ID is required" });

  try {
  await db.query("UPDATE courses SET assigned_to = ? WHERE id = ?", [lecturer_id, id]);
    res.json({ message: "Lecturer assigned successfully" });
  } catch (err) {
    console.error("❌ Error assigning lecturer:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   🗑 DELETE COURSE
============================ */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM courses WHERE id = ?", [id]);
    res.json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting course:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   📘 GET ALL LECTURERS (for assign dropdown)
============================ */
router.get("/lecturers", async (req, res) => {
  try {
    const [lecturers] = await db.query(
      "SELECT id, name FROM users WHERE role = 'lecturer' ORDER BY name ASC"
    );
    res.json(Array.isArray(lecturers) ? lecturers : []);
  } catch (err) {
    console.error("❌ Error fetching lecturers:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   ✏ UPDATE EXISTING COURSE
============================ */
router.put("/:id", authenticateToken, authorizeRole("pl"), async (req, res) => {
  const { id } = req.params;
  const { course_name, course_code, faculty_name, assigned_to } = req.body;

  if (!course_name || !course_code || !faculty_name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [result] = await db.query(
      "UPDATE courses SET course_name = ?, course_code = ?, faculty_name = ?, assigned_to = ? WHERE id = ?",
      [course_name, course_code, faculty_name, assigned_to || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({ message: "Course updated successfully" });
  } catch (err) {
    console.error("❌ Error updating course:", err);
    res.status(500).json({ message: "Database update error" });
  }
});

// ✅ Get all courses under PRL’s stream
router.get("/prl/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `
      SELECT 
        c.id AS course_id,
        c.course_name,
        c.course_code,
        l.name AS lecturer_name,
        cl.class_name
      FROM courses c
      LEFT JOIN lecturers l ON c.lecturer_id = l.id
      LEFT JOIN classes cl ON c.class_id = cl.id
      WHERE c.stream_id = (
        SELECT stream_id FROM principal_lecturers WHERE id = ?
      )
      `,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching PRL courses:", err);
    res.status(500).json({ error: "Failed to fetch courses." });
  }
});

export default router;