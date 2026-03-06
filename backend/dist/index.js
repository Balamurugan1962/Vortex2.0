"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./db");
const auth_1 = __importDefault(require("./routes/auth"));
const admin_1 = __importDefault(require("./routes/admin"));
const settings_1 = __importDefault(require("./routes/settings"));
const questions_1 = __importDefault(require("./routes/questions"));
const submissions_1 = __importDefault(require("./routes/submissions"));
const exams_1 = __importDefault(require("./routes/exams"));
const encryption_1 = __importDefault(require("./routes/encryption"));
dotenv_1.default.config();
console.log('Starting Vortex Backend...');
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize Database
(0, db_1.initDb)();
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/questions', questions_1.default);
app.use('/api/submissions', submissions_1.default);
app.use('/api/encryption', encryption_1.default);
console.log('Registered /api/questions');
console.log('Registered /api/encryption');
app.use('/api/exams', exams_1.default);
console.log('Registered /api/questions, /api/submissions, /api/exams');
// Test raw DB connection route
app.get('/api/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
}));
// Example route
app.get('/api', (req, res) => {
    res.json({ message: 'Welcome to Vortex API' });
});
// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port} and listening on all interfaces (0.0.0.0)`);
});
