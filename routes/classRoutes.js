import express from "express";
import db from "../db.js";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

/* ============================
   📘 GET ALL CLASSES
============================ */
router.get("/", async (req, res) => {
  try {
    const [classes] = await db.query(
      `SELECT c.id, c.class_name, c.venue, c.schedule_time, 
              co.course_name, u.name AS lecturer_name
       FROM classes c
       JOIN courses co ON c.course_id = co.id
       LEFT JOIN users u ON c.lecturer_id = u.id
       ORDER BY c.id ASC`
    );
    res.json(Array.isArray(classes) ? classes : []);
  } catch (err) {
    console.error("❌ Error fetching classes:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   📘 GET COURSES (for dropdown)
============================ */
router.get("/courses", async (req, res) => {
  try {
    const [courses] = await db.query(
      "SELECT id, course_name FROM courses ORDER BY course_name ASC"
    );
    res.json(Array.isArray(courses) ? courses : []);
  } catch (err) {
    console.error("❌ Error fetching courses:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   📘 GET LECTURERS (for dropdown)
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
   📝 ADD NEW CLASS
============================ */
router.post("/", async (req, res) => {
  const { class_name, venue, scheduled_time, course_id, lecturer_id } = req.body;

  if (!class_name || !schedule_time || !course_id) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO classes (class_name, venue, schedule_time, course_id, lecturer_id)
       VALUES (?, ?, ?, ?, ?)`,
      [class_name, venue || "", schedule_time, course_id, lecturer_id || null]
    );

    res.status(201).json({ message: "Class added successfully", id: result.insertId });
  } catch (err) {
    console.error("❌ Error adding class:", err);
    res.status(500).json({ message: "Database insert error" });
  }
});

/* ============================
   ✏ UPDATE EXISTING CLASS
============================ */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { class_name, venue, scheduled_time, course_id, lecturer_id } = req.body;

  if (!class_name || !schedule_time || !course_id) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [result] = await db.query(
      `UPDATE classes 
       SET class_name = ?, venue = ?, schedule_time = ?, course_id = ?, lecturer_id = ?
       WHERE id = ?`,
      [class_name, venue || "", schedule_time, course_id, lecturer_id || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json({ message: "Class updated successfully" });
  } catch (err) {
    console.error("❌ Error updating class:", err);
    res.status(500).json({ message: "Database update error" });
  }
});

/* ============================
   🔁 ASSIGN LECTURER TO CLASS
   Protected: PL only
============================ */
router.put("/:id/assign", authenticateToken, authorizeRole("pl"), async (req, res) => {
  const { id } = req.params;
  const { lecturer_id } = req.body;

  if (!lecturer_id) return res.status(400).json({ message: "Lecturer ID is required" });

  try {
    const [result] = await db.query(
      `UPDATE classes SET lecturer_id = ? WHERE id = ?`,
      [lecturer_id, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Lecturer assigned to class" });
  } catch (err) {
    console.error("❌ Error assigning lecturer to class:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   🔁 ASSIGN / CHANGE COURSE FOR CLASS
   Protected: PL only
============================ */
router.put("/:id/assign-course", authenticateToken, authorizeRole("pl"), async (req, res) => {
  const { id } = req.params;
  const { course_id } = req.body;

  if (!course_id) return res.status(400).json({ message: "Course ID is required" });

  try {
    const [result] = await db.query(
      `UPDATE classes SET course_id = ? WHERE id = ?`,
      [course_id, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Course assigned to class" });
  } catch (err) {
    console.error("❌ Error assigning course to class:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// ✅ Get all classes under a PRL’s stream
router.get("/prl/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `
      SELECT 
        cl.id AS class_id,
        cl.class_name,
        c.course_name,
        c.course_code,
        l.name AS lecturer_name,
        COUNT(s.id) AS total_students
      FROM classes cl
      LEFT JOIN courses c ON cl.course_id = c.id
      LEFT JOIN users l ON cl.lecturer_id = l.id
      LEFT JOIN users s ON s.class_id = cl.id
      WHERE cl.stream_id = (
        SELECT stream_id FROM principal_lecturers WHERE id = ?
      )
      GROUP BY cl.id, cl.class_name, c.course_name, c.course_code, l.name
      ORDER BY cl.class_name ASC
      `,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching PRL classes:", err);
    res.status(500).json({ error: "Failed to fetch classes." });
  }
});

export default router;

