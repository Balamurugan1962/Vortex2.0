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
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
function initSubmissionsTable() {
    return __awaiter(this, void 0, void 0, function* () {
        const sql = `
        CREATE TABLE IF NOT EXISTS submissions (
            id SERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            exam_id VARCHAR(255) DEFAULT 'default',
            responses JSONB NOT NULL,
            violations INTEGER DEFAULT 0,
            violation_details JSONB,
            status VARCHAR(50) DEFAULT 'submitted',
            submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_email, exam_id)
        );
    `;
        try {
            yield db_1.pool.query(sql);
            console.log('Submissions table created successfully');
            process.exit(0);
        }
        catch (err) {
            console.error('Error creating submissions table:', err);
            process.exit(1);
        }
    });
}
initSubmissionsTable();
