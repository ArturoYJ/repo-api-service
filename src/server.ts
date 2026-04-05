import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { authRouter } from './routes/auth.routes';
import { productosRouter } from './routes/productos.routes';
import { variantesRouter } from './routes/variantes.routes';
import { sucursalesRouter } from './routes/sucursales.routes';
import { inventarioRouter } from './routes/inventario.routes';
import { ventasRouter } from './routes/ventas.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { motivosRouter } from './routes/motivos.routes';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());
app.use(cookieParser());

app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/productos', productosRouter);
app.use('/api/v1/variantes', variantesRouter);
app.use('/api/v1/sucursales', sucursalesRouter);
app.use('/api/v1/inventario', inventarioRouter);
app.use('/api/v1/ventas', ventasRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/motivos', motivosRouter);

app.listen(PORT, () => {
  console.log(`API Service corriendo en puerto ${PORT}`);
});

export default app;