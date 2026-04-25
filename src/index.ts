import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import apiRouter from './routes/api';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', apiRouter);

app.listen(port, () => {
  console.log(`Punchi orchestrator listening on :${port}`);
});

process.on('unhandledRejection', reason => {
  console.error('unhandledRejection', reason);
});
process.on('uncaughtException', err => {
  console.error('uncaughtException', err);
});
