import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import queryRouter from './routes/query.js';
import schemaRouter from './routes/schema.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/query', queryRouter);
app.use('/api/schema', schemaRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'QueryMind Backend is running' });
});

app.listen(port, () => {
  console.log(`QueryMind Backend listening at http://localhost:${port}`);
});
