import express from "express";
import db from "../db.js";

const router = express.Router();

/* ------------------------------------------------------------------
   🎓 1. PRL (Principal Lecturer) monitoring overview
------------------------------------------------------------------ */
router.get("/prl/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [results] = await db.query(`
      SELECT 
        u.id AS lecturer_id,
        u.name AS lecturer_name,
        COUNT(r.id) AS total_reports,
        ROUND(AVG(rt.rating), 1) AS avg_rating,
        MAX(r.created_at) AS last_submission
      FROM users u
      LEFT JOIN reports r ON r.lecturer_id = u.id
      LEFT JOIN ratings rt ON rt.report_id = r.id
      WHERE u.role = 'lecturer'
      GROUP BY u.id, u.name
      ORDER BY total_reports DESC
    `);

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching PRL monitoring data:", err);
    res.status(500).json({ message: "Failed to fetch PRL monitoring data" });
  }
});

/* ------------------------------------------------------------------
   📊 2. PRL statistics (weekly submission trends)
------------------------------------------------------------------ */
router.get("/prl/:id/stats", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT WEEK(r.created_at) AS week, COUNT(*) AS count
      FROM reports r
      GROUP BY WEEK(r.created_at)
      ORDER BY week ASC
    `);

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching PRL stats data:", err);
    res.status(500).json({ message: "Failed to fetch PRL stats data" });
  }
});

/* ------------------------------------------------------------------
   👩‍🏫 3. Lecturer-specific monitoring (used by LecturerDashboard)
------------------------------------------------------------------ */
router.get("/lecturer/:lecturerId", async (req, res) => {
  const { lecturerId } = req.params;

  try {
    const [results] = await db.query(`
      SELECT 
        r.id AS report_id,
        r.week_of_reporting,
        r.date_of_lecture,
        r.topic_taught,
        r.faculty_name,
        r.class_name,
        r.course_name,
        COUNT(sr.student_id) AS students_count,
        COALESCE(AVG(rt.rating), 0) AS avg_rating
      FROM reports r
      LEFT JOIN student_reports sr ON r.id = sr.report_id
      LEFT JOIN ratings rt ON r.id = rt.report_id
      WHERE r.lecturer_id = ?
      GROUP BY r.id, r.week_of_reporting, r.date_of_lecture, r.topic_taught, 
               r.faculty_name, r.class_name, r.course_name
      ORDER BY r.week_of_reporting ASC
    `, [lecturerId]);

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching lecturer monitoring data:", err);
    res.status(500).json({ message: "Failed to fetch lecturer monitoring data" });
  }
});

export default router;