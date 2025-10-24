// backend/routes/reportRoutes.js
import express from "express";
import db from "../db.js";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

/* ============================
   📘 GET ALL REPORTS
============================ */
router.get("/", async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, week_of_reporting, date_of_lecture, topic_taught, learning_outcomes, recommendations,
        students_present, total_registered, class_id, lecturer_id, feedback, created_at, faculty_name,
        class_name, course_name, course_code, venue, scheduled_time
      FROM reports ORDER BY created_at DESC`
    );
    res.json(Array.isArray(results) ? results : []);
  } catch (err) {
    console.error("❌ Error fetching reports:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   👨‍🏫 GET REPORTS BY LECTURER
============================ */
router.get("/lecturer/:lecturerId", async (req, res) => {
  const { lecturerId } = req.params;
  try {
    const [results] = await db.query(
      `
      SELECT r.id, r.week_of_reporting, r.date_of_lecture, r.topic_taught, r.learning_outcomes, r.recommendations,
        r.students_present, r.total_registered, r.class_id, r.lecturer_id, r.feedback, r.created_at, r.faculty_name,
        r.class_name, r.course_name, r.course_code, r.venue, r.scheduled_time, u.name AS lecturer_name
      FROM reports r
      JOIN users u ON r.lecturer_id = u.id
      WHERE r.lecturer_id = ?
      ORDER BY r.week_of_reporting ASC
      `,
      [lecturerId]
    );
    res.json(Array.isArray(results) ? results : []);
  } catch (err) {
    console.error("❌ Error fetching lecturer reports:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   🎓 GET REPORTS BY STUDENT
============================ */
router.get("/student/:studentId", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [results] = await db.query(
      `
      SELECT r.id, r.week_of_reporting, r.date_of_lecture, r.topic_taught, r.learning_outcomes, r.recommendations,
        r.students_present, r.total_registered, r.class_id, r.lecturer_id, r.feedback, r.created_at, r.faculty_name,
        r.class_name, r.course_name, r.course_code, r.venue, r.scheduled_time,
        u.name AS lecturer_name,
        COALESCE(rt.rating, 0) AS rating
      FROM reports r
      LEFT JOIN users u ON r.lecturer_id = u.id
      LEFT JOIN student_reports sr ON r.id = sr.report_id
      LEFT JOIN ratings rt ON rt.report_id = r.id AND rt.student_id = ?
      WHERE sr.student_id = ?
      ORDER BY r.week_of_reporting ASC
      `,
      [studentId, studentId]
    );
    res.json(Array.isArray(results) ? results : []);
  } catch (err) {
    console.error("❌ Error fetching student reports:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   👩‍🏫 GET REPORTS BY PRL
============================ */
router.get("/prl/:id", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT r.id, r.week_of_reporting, r.date_of_lecture, r.topic_taught, r.learning_outcomes, r.recommendations,
        r.students_present, r.total_registered, r.class_id, r.lecturer_id, r.feedback, r.created_at, r.faculty_name,
        r.class_name, r.course_name, r.course_code, r.venue, r.scheduled_time, u.name AS lecturer_name
      FROM reports r
      JOIN users u ON u.id = r.lecturer_id
      ORDER BY r.created_at DESC
    `);
    res.json(Array.isArray(results) ? results : []);
  } catch (err) {
    console.error("❌ Error fetching PRL reports:", err);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
});

/* ============================
   👩‍💼 GET REPORTS BY PROGRAM LEADER
   Logic:
   1️⃣ Find all courses assigned to lecturers in programs led by this PL
   2️⃣ Find all classes under those courses
   3️⃣ Fetch all reports for those classes
============================ */
router.get("/pl/:plId", async (req, res) => {
  const { plId } = req.params;

  try {
    // Defensive approach: find programs for this PL, then courses, classes, then reports
    const [programs] = await db.query("SELECT id FROM programs WHERE pl_id = ?", [plId]);
    const programIds = programs.map((p) => p.id);

    if (programIds.length === 0) return res.json([]);

    // Find courses belonging to these programs (try program_id column)
    const [courses] = await db.query(
      `SELECT id FROM courses WHERE program_id IN (?)`,
      [programIds]
    );
    const courseIds = courses.map((c) => c.id);

    // If no courses found by program_id, try matching assigned_to or stream_id as fallback
    if (courseIds.length === 0) {
      const [altCourses] = await db.query(
        `SELECT id FROM courses WHERE assigned_to IN (?) OR stream_id IN (?)`,
        [programIds, programIds]
      );
      courseIds.push(...altCourses.map((c) => c.id));
    }

    if (courseIds.length === 0) return res.json([]);

    // Find classes under these courses
    const [classes] = await db.query(`SELECT id FROM classes WHERE course_id IN (?)`, [courseIds]);
    const classIds = classes.map((c) => c.id);

    if (classIds.length === 0) return res.json([]);

    // Finally fetch reports for these class IDs
    const [results] = await db.query(
      `SELECT r.id, r.week_of_reporting, r.date_of_lecture, r.topic_taught, r.learning_outcomes, r.recommendations,
        r.students_present, r.total_registered, r.class_id, r.lecturer_id, r.feedback, r.created_at, r.faculty_name,
        r.class_name, r.course_name, r.course_code, r.venue, r.scheduled_time, u.name AS lecturer_name
      FROM reports r JOIN users u ON r.lecturer_id = u.id WHERE r.class_id IN (?) ORDER BY r.created_at DESC`,
      [classIds]
    );

    res.json(Array.isArray(results) ? results : []);
  } catch (err) {
    console.error("❌ Error fetching PL reports:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   📊 GET REPORT STATS FOR PL
============================ */
router.get("/pl/:plId/stats", async (req, res) => {
  const { plId } = req.params;

  try {
    // Similar defensive approach: find program -> courses -> classes -> stats
    const [programs] = await db.query("SELECT id FROM programs WHERE pl_id = ?", [plId]);
    const programIds = programs.map((p) => p.id);
    if (programIds.length === 0) return res.json([]);

    const [courses] = await db.query(`SELECT id FROM courses WHERE program_id IN (?)`, [programIds]);
    const courseIds = courses.map((c) => c.id);
    if (courseIds.length === 0) return res.json([]);

    const [classes] = await db.query(`SELECT id FROM classes WHERE course_id IN (?)`, [courseIds]);
    const classIds = classes.map((c) => c.id);
    if (classIds.length === 0) return res.json([]);

    const [results] = await db.query(
      `SELECT r.week_of_reporting AS week, COUNT(*) AS count FROM reports r WHERE r.class_id IN (?) GROUP BY r.week_of_reporting ORDER BY r.week_of_reporting ASC`,
      [classIds]
    );

    res.json(Array.isArray(results) ? results : []);
  } catch (err) {
    console.error("❌ Error fetching PL stats:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   📊 PROGRAM-WISE STATS FOR PL
============================ */
router.get("/pl/:plId/program-stats", async (req, res) => {
  const { plId } = req.params;

  try {
    const [programs] = await db.query("SELECT id, name FROM programs WHERE pl_id = ?", [plId]);
    const programIds = programs.map((p) => p.id);
    if (programIds.length === 0) return res.json([]);

    // For each program, count reports
    const stats = [];
    for (const pr of programs) {
      const [courses] = await db.query(`SELECT id FROM courses WHERE program_id = ?`, [pr.id]);
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length === 0) {
        stats.push({ program_name: pr.name, total_reports: 0 });
        continue;
      }
      const [classes] = await db.query(`SELECT id FROM classes WHERE course_id IN (?)`, [courseIds]);
      const classIds = classes.map((c) => c.id);
      if (classIds.length === 0) {
        stats.push({ program_name: pr.name, total_reports: 0 });
        continue;
      }
      const [resCount] = await db.query(`SELECT COUNT(*) AS cnt FROM reports WHERE class_id IN (?)`, [classIds]);
      stats.push({ program_name: pr.name, total_reports: resCount[0].cnt || 0 });
    }

    res.json(stats);
  } catch (err) {
    console.error("❌ Error fetching program stats:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   📝 ADD NEW REPORT (LECTURER)
============================ */
router.post("/", async (req, res) => {
  const {
    lecturer_id,
    week_of_reporting,
    date_of_lecture,
    topic_taught,
    learning_outcomes,
    recommendations,
    students_present,
    total_registered,
    venue,
    scheduled_time,
    feedback
  } = req.body;

  if (!lecturer_id || !week_of_reporting || !date_of_lecture || !topic_taught) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [classes] = await db.query(
      `
      SELECT c.id AS class_id, c.class_name AS class_name, c.course_name, c.course_code, c.faculty_name
      FROM classes c
      JOIN lecturer_classes lc ON lc.class_id = c.id
      WHERE lc.lecturer_id = ?
      LIMIT 1
      `,
      [lecturer_id]
    );

    let cls = null;

    if (classes.length > 0) {
      cls = classes[0];
    } else {
      // Fallback: try to find a class by class_name or course_code provided in the request body
      const { class_name, course_code } = req.body;
      if (class_name || course_code) {
        const [found] = await db.query(
          `SELECT id AS class_id, class_name AS class_name, course_name, course_code, faculty_name FROM classes WHERE class_name = ? OR course_code = ? LIMIT 1`,
          [class_name || '', course_code || '']
        );
        if (found && found.length > 0) {
          cls = found[0];
        }
      }
    }

    // If still no class found, use provided form values (class_id will be null)
    if (!cls) {
      cls = {
        class_id: null,
        class_name: req.body.class_name || '',
        course_name: req.body.course_name || '',
        course_code: req.body.course_code || '',
        faculty_name: req.body.faculty_name || ''
      };
    }

    // Corrected INSERT: columns and placeholders must match and be in the same order
    const [result] = await db.query(
      `
      INSERT INTO reports (
        lecturer_id, faculty_name, class_name, class_id, course_name, course_code,
        week_of_reporting, date_of_lecture, students_present, total_registered,
        venue, scheduled_time, topic_taught, learning_outcomes, recommendations, feedback
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        // values must follow the column order above
        lecturer_id,
        cls.faculty_name || req.body.faculty_name || '',
        cls.class_name || req.body.class_name || '',
        cls.class_id || null,
        cls.course_name || req.body.course_name || '',
        cls.course_code || req.body.course_code || '',
        week_of_reporting,
        date_of_lecture,
        Number(students_present) || 0,
        Number(total_registered) || 0,
        venue || '',
        scheduled_time || '',
        topic_taught,
        learning_outcomes || '',
        recommendations || '',
        feedback || ''
      ]
    );

    const reportId = result.insertId;

    // If we have a real class_id, map students to this report
    if (cls.class_id) {
      const [students] = await db.query(
        "SELECT id FROM users WHERE role = 'student' AND class_id = ?",
        [cls.class_id]
      );

      if (students.length > 0) {
        const values = students.map((s) => [s.id, reportId]);
        await db.query("INSERT IGNORE INTO student_reports (student_id, report_id) VALUES ?", [values]);
      }
    }

    res.status(201).json({ message: "Report added successfully", id: reportId });
  } catch (err) {
    console.error("❌ Error adding report:", err);
    // Log full stack to a file for debugging
    try {
      const fs = await import('fs');
      fs.writeFileSync('report_insert_error.log', new Date().toISOString() + '\n' + (err.stack || err.message || JSON.stringify(err)));
    } catch (fileErr) {
      console.error('Failed to write error log', fileErr);
    }
    // Return a generic error to client
    res.status(500).json({ message: "Database insert error" });
  }
});

/* ============================
   ✅ APPROVE / REJECT REPORT
============================ */
router.put("/:reportId/approve", async (req, res) => {
  const { reportId } = req.params;
  const { status } = req.body;
  try {
    await db.query("UPDATE reports SET status = ? WHERE id = ?", [status, reportId]);
    res.json({ message: 'Report ${status}' });
  } catch (err) {
    console.error("❌ Error updating report status:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/* ============================
   🗒 FEEDBACK (PRL)
============================ */
router.post("/:id/feedback", authenticateToken, authorizeRole("pl"), async (req, res) => {
  const { id } = req.params;
  const { feedback } = req.body;
  try {
    await db.query("UPDATE reports SET feedback = ? WHERE id = ?", [feedback, id]);
    res.json({ message: 'Feedback submitted for report ${id}' });
  } catch (err) {
    console.error("❌ Error submitting feedback:", err);
    res.status(500).json({ message: "Failed to submit feedback" });
  }
});

/* ============================
   ⭐ STUDENT RATING
============================ */
router.post("/:reportId/rate", async (req, res) => {
  const { reportId } = req.params;
  const { student_id, rating } = req.body;

  if (!student_id || !rating)
    return res.status(400).json({ message: "Missing student ID or rating" });

  try {
    await db.query(
      `
      INSERT INTO ratings (student_id, report_id, rating, created_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), created_at = NOW()
      `,
      [student_id, reportId, rating]
    );
    res.json({ message: "Rating submitted successfully" });
  } catch (err) {
    console.error("❌ Error submitting rating:", err);
    res.status(500).json({ message: "Database error" });
  }
});

router.get("/:reportId/ratings", async (req, res) => {
  const { reportId } = req.params;

  try {
    const [results] = await db.query(
      `SELECT AVG(rating) AS avg_rating, COUNT(*) AS total_ratings 
       FROM ratings 
       WHERE report_id = ?`,
      [reportId]
    );

    res.json(results[0] || { avg_rating: 0, total_ratings: 0 });
  } catch (err) {
    console.error("❌ Error fetching ratings:", err);
    res.status(500).json({ message: "Database error" });
  }
});

router.get("/student/:studentId/ratings", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [results] = await db.query(
      "SELECT report_id, rating FROM ratings WHERE student_id = ?",
      [studentId]
    );
    const ratingsObj = {};
    results.forEach((r) => {
      ratingsObj[r.report_id] = r.rating;
    });
    res.json(ratingsObj);
  } catch (err) {
    console.error("❌ Error fetching student ratings:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// -----------------------------
// Submit feedback for a report
// -----------------------------
router.post("/:reportId/feedback", async (req, res) => {
  const { reportId } = req.params;
  const { lecturer_id, feedback } = req.body;

  if (!feedback || !lecturer_id) {
    return res.status(400).json({ message: "Feedback and lecturer_id are required" });
  }

  try {
    const [result] = await db.query(
      `UPDATE reports
       SET feedback = ?
       WHERE id = ? AND lecturer_id = ?`,
      [feedback, reportId, lecturer_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Report not found or you are not authorized" });
    }

    res.json({ message: "Feedback submitted successfully" });
  } catch (err) {
    console.error("Error submitting feedback:", err);
    res.status(500).json({ message: "Failed to submit feedback" });
  }
});

export default router;