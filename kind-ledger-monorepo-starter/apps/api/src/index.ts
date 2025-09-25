
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { router as connectionsRouter } from './routes/connections.js';
import { router as oauthRouter } from './routes/oauth.js';
import { router as syncRouter } from './routes/sync.js';
import { router as csvRouter } from './routes/csv.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(pinoHttp());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/connections', connectionsRouter);
app.use('/oauth', oauthRouter);
app.use('/api/sync', syncRouter);
app.use('/api/csv', csvRouter);

const port = Number(process.env.PORT || 4001);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
