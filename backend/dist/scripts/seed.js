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
const db_1 = require("../db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const seedDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Initializing database schema...');
        yield (0, db_1.initDb)();
        console.log('Seeding demo accounts...');
        const salt = yield bcryptjs_1.default.genSalt(10);
        const passwordHash = yield bcryptjs_1.default.hash('password123', salt);
        // Demo Instructor
        yield db_1.pool.query(`INSERT INTO users (name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (email) DO NOTHING`, ['Demo Instructor', 'instructor@demo.com', passwordHash, 'instructor']);
        // Demo Student
        yield db_1.pool.query(`INSERT INTO users (name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (email) DO NOTHING`, ['Demo Student', 'student@demo.com', passwordHash, 'student']);
        // Demo Admin
        yield db_1.pool.query(`INSERT INTO users (name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (email) DO NOTHING`, ['Demo Admin', 'admin@demo.com', passwordHash, 'admin']);
        console.log('Successfully seeded demo accounts!');
        console.log('Admin: admin@demo.com / password123');
        console.log('Instructor: instructor@demo.com / password123');
        console.log('Student: student@demo.com / password123');
        process.exit(0);
    }
    catch (error) {
        console.error('Error seeding demo accounts:', error);
        process.exit(1);
    }
});
seedDatabase();
