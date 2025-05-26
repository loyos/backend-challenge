class LogService {
    // Add a log entry for a specific job
    public printLog(taskType: string, message: string): void {
        console.log(
            `[${new Date().toISOString()}] [${taskType}] ${message} \n`
        );
    }
}

// singleton it's enough
export const logService = new LogService();
