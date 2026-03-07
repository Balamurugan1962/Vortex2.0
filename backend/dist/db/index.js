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
exports.initDb = exports.pool = void 0;
const pg_1 = require("pg");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@db:5432/vortex',
});
const initDb = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (retries = 5, delay = 5000) {
    while (retries > 0) {
        try {
            const initSqlPath = path_1.default.join(process.cwd(), 'src', 'db', 'init.sql');
            const sql = fs_1.default.readFileSync(initSqlPath, 'utf8');
            yield exports.pool.query(sql);
            console.log('Database initialized successfully.');
            return;
        }
        catch (error) {
            retries -= 1;
            console.error(`Database initialization attempt failed. Retries left: ${retries}`);
            if (retries === 0) {
                console.error('Final database initialization failure:', error);
                throw error;
            }
            yield new Promise(res => setTimeout(res, delay));
        }
    }
});
exports.initDb = initDb;
