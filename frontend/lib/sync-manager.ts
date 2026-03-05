import * as api from "./api";

const QUEUE_KEY = "vortex_submission_queue";

interface QueuedSubmission {
    examId: number;
    answers: any;
    timestamp: number;
}

export const queueSubmission = (examId: number, answers: any) => {
    if (typeof window === "undefined") return;
    const queue: QueuedSubmission[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    queue.push({ examId, answers, timestamp: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const syncPendingSubmissions = async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;

    const queue: QueuedSubmission[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    if (queue.length === 0) return;

    console.log(`Attempting to sync ${queue.length} pending submissions...`);
    const remaining: QueuedSubmission[] = [];

    for (const item of queue) {
        try {
            await api.submitExamAnswers(item.examId, item.answers);
        } catch (error) {
            console.error("Failed to sync submission:", error);
            remaining.push(item);
        }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
};
