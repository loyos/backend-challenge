import { Job } from './Job';
import { Task } from '../models/Task';
import { Report, TaskReport } from '../models/Report';
import { Result } from '../models/Result';
import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';

export class ReportGenerationJob implements Job {
    private resultRepository: Repository<Result>;
    private taskRepository: Repository<Task>;
    private workflowRepository: Repository<Workflow>;

    constructor() {
        this.resultRepository = AppDataSource.getRepository(Result);
        this.taskRepository = AppDataSource.getRepository(Task);
        this.workflowRepository = AppDataSource.getRepository(Workflow);
    }

    async run(task: Task): Promise<string> {
        console.log(`Running report generation for task ${task.taskId}...`);

        try {
            const report = await this.generateReport(task);
            await this.saveReportToWorkflow(task, report);
            return JSON.stringify(report); // This will be saved in the output of the task (result table)
        } catch (error) {
            console.error(
                `Error generating report for task ${task.taskId}:`,
                error
            );
            throw new Error(
                `Failed to generate report for task ${task.taskId}`
            );
        }
    }

    private async generateReport(task: Task): Promise<Report> {
        const report: Report = new Report();
        report.tasks = [];
        report.finalReport = '';
        report.workflowId = task.workflow.workflowId;

        try {
            // Fetch all tasks in the current workflow
            const tasks = await this.getWorkflowTasks(task.workflow.workflowId);

            // Generate task reports
            for (const workflowTask of tasks) {
                try {
                    const taskReport = await this.generateTaskReport(
                        workflowTask
                    );
                    report.tasks.push(taskReport);
                    report.finalReport += `Task ${workflowTask.taskType} - Output: ${taskReport.output}\n`;
                } catch (error) {
                    console.error(
                        `Error generating task report for task ${workflowTask.taskId}:`,
                        error
                    );
                }
            }
        } catch (error) {
            console.error(
                `Error generating report for workflow ${task.workflow.workflowId}:`,
                error
            );
            throw new Error(
                `Failed to generate report for workflow ${task.workflow.workflowId}`
            );
        }

        return report;
    }

    private async getWorkflowTasks(workflowId: string): Promise<Task[]> {
        try {
            const tasks = await this.taskRepository.find({
                where: { workflow: { workflowId } },
                relations: ['workflow'],
            });

            // Exclude report tasks
            return tasks.filter((t) => t.taskType !== 'report');
        } catch (error) {
            console.error(
                `Error fetching tasks for workflow ${workflowId}:`,
                error
            );
            throw new Error(`Failed to fetch tasks for workflow ${workflowId}`);
        }
    }

    private async generateTaskReport(task: Task): Promise<TaskReport> {
        const taskReport: TaskReport = new TaskReport();
        taskReport.taskId = task.taskId;
        taskReport.type = task.taskType;

        try {
            const result = await this.resultRepository.findOne({
                where: { taskId: task.taskId },
            });

            if (task.status === 'failed') {
                taskReport.output = `Task failed with error: ${
                    result?.data || 'Unknown error'
                }`;
            } else {
                taskReport.output = result ? result.data : null;
            }
        } catch (error) {
            console.error(
                `Error fetching result for task ${task.taskId}:`,
                error
            );
            taskReport.output = 'Error fetching task result';
        }

        return taskReport;
    }

    private async saveReportToWorkflow(
        task: Task,
        report: Report
    ): Promise<void> {
        try {
            const currentWorkflow = await this.workflowRepository.findOne({
                where: { workflowId: task.workflow.workflowId },
                relations: ['tasks'],
            });

            if (currentWorkflow) {
                currentWorkflow.finalResult = report.finalReport;
                await this.workflowRepository.save(currentWorkflow);
            }
        } catch (error) {
            console.error(
                `Error saving report to workflow ${task.workflow.workflowId}:`,
                error
            );
            throw new Error(
                `Failed to save report to workflow ${task.workflow.workflowId}`
            );
        }
    }
}
