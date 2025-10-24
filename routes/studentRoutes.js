import express from "express";
import db from "../db.js";

const router = express.Router();
// Debug: log when this routes module is loaded
console.log('✅ studentRoutes module loaded');

// Simple debug endpoint to verify route mounting
router.get('/debug', (req, res) => {
  return res.json({ ok: true, msg: 'studentRoutes debug OK' });
});

// GET /api/students/:id/reports
router.get('/:id/reports', async (req, res) => {
  const studentId = req.params.id;
  try {
    // Fetch reports linked to this student via student_reports
    // Use the same column list as other report endpoints to avoid schema mismatches
    const [rows] = await db.query(
      `
      SELECT r.id, r.week_of_reporting, r.date_of_lecture, r.topic_taught, r.learning_outcomes, r.recommendations,
        r.students_present, r.total_registered, r.class_id, r.lecturer_id, r.feedback, r.created_at, r.faculty_name,
        r.class_name, r.course_name, r.course_code, r.venue, r.scheduled_time,
        COALESCE(rt.rating, 0) AS rating
      FROM reports r
      JOIN student_reports sr ON sr.report_id = r.id
      LEFT JOIN ratings rt ON rt.report_id = r.id AND rt.student_id = ?
      WHERE sr.student_id = ?
      ORDER BY r.date_of_lecture DESC
      `,
      [studentId, studentId]
    );
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('❌ Error fetching student reports:', err);
    try {
      const fs = await import('fs');
      fs.appendFileSync('student_routes_errors.log', new Date().toISOString() + ' - reports error: ' + (err.stack || err.message) + '\n');
    } catch (e) {
      console.error('Failed to write student route error log', e);
    }
    return res.status(500).json([]);
  }
});

// GET /api/students/:id/ratings
router.get('/:id/ratings', async (req, res) => {
  const studentId = req.params.id;
  try {
    const [rows] = await db.query('SELECT report_id, rating FROM ratings WHERE student_id = ?', [studentId]);
    // return as object keyed by report id for frontend convenience
    const obj = {};
    for (const r of rows) obj[r.report_id] = r.rating;
    return res.json(obj);
  } catch (err) {
    console.error('❌ Error fetching student ratings:', err);
    return res.status(500).json({});
  }
});

// GET /api/students/:id/stats
router.get('/:id/stats', async (req, res) => {
  const studentId = req.params.id;
  try {
    const [rows] = await db.query(
      `SELECT r.week_of_reporting AS week, COUNT(*) AS count
       FROM reports r
       JOIN student_reports sr ON sr.report_id = r.id
       WHERE sr.student_id = ?
       GROUP BY r.week_of_reporting
       ORDER BY r.week_of_reporting ASC`,
      [studentId]
    );
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('❌ Error fetching student stats:', err);
    return res.status(500).json([]);
  }
});

// POST /api/students/:id/rate/:reportId
router.post('/:id/rate/:reportId', async (req, res) => {
  const studentId = req.params.id;
  const reportId = req.params.reportId;
  const { rating } = req.body;
  if (typeof rating !== 'number' && typeof rating !== 'string') {
    return res.status(400).json({ message: 'Rating is required' });
  }
  const numeric = Number(rating) || 0;
  try {
    // upsert rating
    const [existing] = await db.query('SELECT id FROM ratings WHERE student_id = ? AND report_id = ?', [studentId, reportId]);
    if (existing.length > 0) {
      await db.query('UPDATE ratings SET rating = ? WHERE student_id = ? AND report_id = ?', [numeric, studentId, reportId]);
      return res.json({ message: 'Rating updated' });
    } else {
      await db.query('INSERT INTO ratings (student_id, report_id, rating) VALUES (?, ?, ?)', [studentId, reportId, numeric]);
      return res.status(201).json({ message: 'Rating recorded' });
    }
  } catch (err) {
    console.error('❌ Error recording rating:', err);
    return res.status(500).json({ message: 'Database error' });
  }
});

export default router;
