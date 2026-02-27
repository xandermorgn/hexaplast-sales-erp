import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import customerInquiryRoutes from './routes/customerInquiryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';
import performaRoutes from './routes/performaRoutes.js';
import workOrderRoutes from './routes/workOrderRoutes.js';
import userManagementRoutes from './routes/userManagementRoutes.js';
import kpiRoutes from './routes/kpiRoutes.js';
import systemSettingsRoutes from './routes/systemSettingsRoutes.js';
import { initDatabase } from './config/database.js';
import { ensureBootstrapMasterAdmin } from './utils/bootstrapMasterAdmin.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initSocket } from './realtime/socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4001;

const originCheck = function(origin, callback) {
  // Allow requests with no origin (like mobile apps, curl, etc.)
  if (!origin) return callback(null, true);

  // LAN/on-prem deployment: allow browser origins on the local network.
  // Session cookies are still required for protected routes.
  return callback(null, true);
};

// CORS configuration for session cookies
// Allow all localhost origins in development (including Windsurf preview proxy)
app.use(cors({
  origin: originCheck,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging for debugging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Serve static files from uploads directory (profile photos, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/inquiries', customerInquiryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/performas', performaRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/system-settings', systemSettingsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Hexaplast Sales ERP Backend is running' });
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

await initDatabase();
await ensureBootstrapMasterAdmin({ logCreated: true });

const httpServer = http.createServer(app);

// Socket.IO server (signal-only) for LAN real-time updates
initSocket(httpServer, { corsOrigin: originCheck });

httpServer.listen(PORT, () => {
  console.log(`✓ Hexaplast Sales ERP Backend running on http://localhost:${PORT}`);
  console.log(`✓ Database: SQLite (sql.js)`);
  console.log(`✓ Auth endpoint: http://localhost:${PORT}/api/auth/login`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});
