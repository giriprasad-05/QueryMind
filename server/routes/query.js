import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Dangerous keywords that should be rejected
const DANGEROUS_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 
  'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXECUTE', 'REPLACE'
];

router.post('/execute', async (req, res) => {
  try {
    const { sql } = req.body;

    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          type: 'INVALID_REQUEST',
          message: 'SQL query string is required.'
        }
      });
    }

    const trimmedSql = sql.trim();
    const upperSql = trimmedSql.toUpperCase();

    // 1. Verify statement starts with SELECT
    if (!upperSql.startsWith('SELECT')) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'READ_ONLY_VIOLATION',
          message: 'Only SELECT queries are allowed.'
        }
      });
    }

    // 2. Reject multiple statements (check for internal semicolons)
    // Semicolon at the very end is fine, but anywhere else is blocked
    const semicolonIndex = trimmedSql.indexOf(';');
    if (semicolonIndex !== -1 && semicolonIndex !== trimmedSql.length - 1) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'MULTIPLE_STATEMENTS_VIOLATION',
          message: 'Multiple SQL statements are not allowed.'
        }
      });
    }

    // 3. Reject dangerous keywords
    const hasDangerousKeyword = DANGEROUS_KEYWORDS.some(keyword => {
      // Regex boundary check to match exact keywords
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(trimmedSql);
    });

    if (hasDangerousKeyword) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'DANGEROUS_KEYWORD_VIOLATION',
          message: 'Query contains forbidden keywords. Only read operations are permitted.'
        }
      });
    }

    // Execute query
    const dbResult = await query(trimmedSql);

    return res.json({
      success: true,
      data: {
        rows: dbResult.rows,
        rowCount: dbResult.rowCount,
        executionTimeMs: dbResult.duration
      }
    });

  } catch (err) {
    // Return safe database error
    return res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        message: err.message || 'An unexpected database error occurred.'
      }
    });
  }
});

export default router;
