// backend/routes/lecturerRoutes.js
import express from "express";
import db from "../db.js";

const router = express.Router();

/* ------------------------------------------------------------------
   📘 1. Get all reports submitted by a lecturer
------------------------------------------------------------------ */
router.get("/:lecturerId/reports", async (req, res) => {
  const { lecturerId } = req.params;

  try {
    const [results] = await db.query(
      `SELECT 
        id,
        week_of_reporting,
        date_of_lecture,
        topic_taught,
        learning_outcomes,
        recommendations,
        students_present,
        total_registered,
        class_id,
        lecturer_id,
        feedback,
        faculty_name,
        class_name,
        course_name,
        course_code,
        venue,
        scheduled_time,
        'approved' AS status
      FROM reports
      WHERE lecturer_id = ?
      ORDER BY week_of_reporting ASC`,
      [lecturerId]
    );

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching lecturer reports:", err);
    res.status(500).json({ message: "Failed to fetch lecturer reports" });
  }
});

/* ------------------------------------------------------------------
   📊 2. Get submission statistics for a lecturer
------------------------------------------------------------------ */
router.get("/:lecturerId/stats", async (req, res) => {
  const { lecturerId } = req.params;

  try {
    const [results] = await db.query(
      `SELECT WEEK(date_of_lecture) AS week, COUNT(*) AS count
       FROM reports
       WHERE lecturer_id = ?
       GROUP BY WEEK(date_of_lecture)
       ORDER BY week ASC`,
      [lecturerId]
    );

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching lecturer stats:", err);
    res.status(500).json({ message: "Failed to fetch submission stats" });
  }
});

/* ------------------------------------------------------------------
   🧩 3. Monitoring data for a lecturer (student attendance/progress)
------------------------------------------------------------------ */
// ✅ Lecturer monitoring route (fixed)
router.get("/:id/monitoring", async (req, res) => {
  const lecturerId = req.params.id;

  try {
    const [rows] = await db.query(
      `
      SELECT 
        s.id AS student_id,
        s.name AS student_name,
        COUNT(DISTINCT r.id) AS reports_submitted,
        COALESCE(ROUND((COUNT(DISTINCT r.id) / 10) * 100, 0), 0) AS attendance, -- assuming 10 total reports
        GREATEST(10 - COUNT(DISTINCT r.id), 0) AS pending_reports
      FROM users s
      LEFT JOIN student_reports sr ON sr.student_id = s.id
      LEFT JOIN reports r ON r.id = sr.report_id AND r.lecturer_id = ?
      WHERE s.role = 'student'
      GROUP BY s.id, s.name
      ORDER BY s.name ASC
      `,
      [lecturerId]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching lecturer monitoring data:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;