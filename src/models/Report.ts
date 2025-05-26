export class Report {
    reportId!: string;
    workflowId!: string;
    finalReport!: string;
    tasks!: TaskReport[];
}

export class TaskReport {
    taskId!: string;
    type!: string;
    output!: string | null;
}
