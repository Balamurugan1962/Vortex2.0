import sqlite3
import json
import base64
import os
from cryptography.fernet import Fernet
from datetime import datetime

# Generate or load encryption key
KEY_FILE = "secret.key"
if not os.path.exists(KEY_FILE):
    encryption_key = Fernet.generate_key()
    with open(KEY_FILE, "wb") as key_file:
        key_file.write(encryption_key)
else:
    with open(KEY_FILE, "rb") as key_file:
        encryption_key = key_file.read()

cipher_suite = Fernet(encryption_key)

DB_FILE = "exam_logs.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            event_type TEXT,
            confidence REAL,
            metadata TEXT
        )
    ''')
    conn.commit()
    conn.close()

def log_violation(event_type: str, confidence: float, metadata: dict = None):
    if metadata is None:
        metadata = {}
    
    timestamp = datetime.now().isoformat()
    
    # Encrypt metadata using AES encryption
    metadata_json = json.dumps(metadata)
    encrypted_metadata = cipher_suite.encrypt(metadata_json.encode('utf-8')).decode('utf-8')
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO violations (timestamp, event_type, confidence, metadata)
        VALUES (?, ?, ?, ?)
    ''', (timestamp, event_type, confidence, encrypted_metadata))
    conn.commit()
    conn.close()
    print(f"Logged Violation: {event_type} at {timestamp}")

def get_logs(limit=10):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT timestamp, event_type, confidence, metadata FROM violations
        ORDER BY id DESC LIMIT ?
    ''', (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    logs = []
    for row in rows:
        timestamp, event_type, confidence, encrypted_metadata = row
        try:
            # Decrypt metadata
            decrypted_metadata_bytes = cipher_suite.decrypt(encrypted_metadata.encode('utf-8'))
            metadata = json.loads(decrypted_metadata_bytes.decode('utf-8'))
        except Exception:
            metadata = {"error": "decryption failed"}
            
        logs.append({
            "timestamp": timestamp,
            "event_type": event_type,
            "confidence": confidence,
            "metadata": metadata
        })
    return logs

# Initialize database when this module is imported
init_db()
