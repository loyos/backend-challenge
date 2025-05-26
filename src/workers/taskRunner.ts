import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { Workflow } from '../models/Workflow';
import { Result } from '../models/Result';
import { logService } from '../services/logService';

export enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed',
}

export class TaskRunner {
    private resultRepository: Repository<Result>;
    private workflowRepository: Repository<Workflow>;

    constructor(private taskRepository: Repository<Task>) {
        this.resultRepository =
            this.taskRepository.manager.getRepository(Result);
        this.workflowRepository =
            this.taskRepository.manager.getRepository(Workflow);
    }

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        logService.printLog(task.taskType, `\n --- Starting --- \n`);

        if (!(await this.checkDependency(task))) return;
        if (!(await this.checkReport(task))) return;

        await this.markTaskInProgress(task);

        try {
            const job = getJobForTaskType(task.taskType);
            logService.printLog(
                task.taskType,
                `Starting JOB ${task.taskType} for task ${task.taskId}...`
            );

            const taskResult = await job.run(task);
            await this.saveTaskResult(task, taskResult);

            logService.printLog(
                task.taskType,
                `Job ${task.taskType} for task ${task.taskId} completed successfully.`
            );
        } catch (error: any) {
            await this.handleTaskFailure(task, error);
            throw error;
        }

        await this.updateWorkflowStatus(task.workflow.workflowId);
    }

    private async markTaskInProgress(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);
    }

    private async saveTaskResult(task: Task, taskResult: any): Promise<void> {
        const result = new Result();
        result.taskId = task.taskId!;
        result.data = JSON.stringify(taskResult || {});
        await this.resultRepository.save(result);

        task.resultId = result.resultId!;
        task.status = TaskStatus.Completed;
        task.progress = null;
        await this.taskRepository.save(task);
    }

    private async handleTaskFailure(task: Task, error: any): Promise<void> {
        console.error(
            `Error running job ${task.taskType} for task ${task.taskId}:`,
            error
        );

        task.status = TaskStatus.Failed;
        task.progress = null;
        await this.taskRepository.save(task);

        const result = new Result();
        result.taskId = task.taskId!;
        result.data = JSON.stringify(error || {});
        await this.resultRepository.save(result);
    }

    private async updateWorkflowStatus(workflowId: string): Promise<void> {
        const workflow = await this.workflowRepository.findOne({
            where: { workflowId },
            relations: ['tasks'],
        });

        if (!workflow) return;

        const allCompleted = workflow.tasks.every(
            (t) => t.status === TaskStatus.Completed
        );
        const anyFailed = workflow.tasks.some(
            (t) => t.status === TaskStatus.Failed
        );

        if (anyFailed) {
            workflow.status = WorkflowStatus.Failed;
        } else if (allCompleted) {
            workflow.status = WorkflowStatus.Completed;
        } else {
            workflow.status = WorkflowStatus.InProgress;
        }

        await this.workflowRepository.save(workflow);
    }

    public async checkReport(task: Task): Promise<boolean> {
        if (task.taskType !== 'report') return true;

        logService.printLog(
            task.taskType,
            'Checking if all tasks in the workflow are completed for report generation...'
        );

        const tasks = await this.taskRepository.find({
            where: { workflow: { workflowId: task.workflow.workflowId } },
        });

        const nonReportTasks = tasks.filter((t) => t.taskType !== 'report');
        const allCompleted = nonReportTasks.every(
            (t) => t.status === TaskStatus.Completed
        );

        if (!allCompleted) {
            logService.printLog(
                task.taskType,
                `Not all tasks in the workflow ${task.workflow.workflowId} are completed. Skipping for now.`
            );
            return false;
        }

        logService.printLog(
            task.taskType,
            `All tasks in the workflow ${task.workflow.workflowId} are completed. Proceeding with report generation.`
        );
        return true;
    }

    public async checkDependency(task: Task): Promise<boolean> {
        if (!task.dependency) return true;

        logService.printLog(
            task.taskType,
            `Task has a dependency: ${task.dependency}, checking...`
        );

        let dependencyTask = await this.taskRepository.findOne({
            where: {
                taskType: task.dependency,
                workflow: { workflowId: task.workflow.workflowId },
            },
        });

        if (!dependencyTask) {
            logService.printLog(
                task.taskType,
                `Dependency task not found: ${task.dependency}. Skipping for now.`
            );
            return false;
        }

        while (dependencyTask?.status !== TaskStatus.Completed) {
            if (dependencyTask?.status === TaskStatus.Failed) {
                throw new Error(
                    `Dependency task "${dependencyTask.taskType}" failed.`
                );
            }

            logService.printLog(
                task.taskType,
                `Waiting for dependency task "${task.dependency}" to complete...`
            );

            await new Promise((resolve) => setTimeout(resolve, 5000));
            dependencyTask = await this.taskRepository.findOne({
                where: {
                    taskType: task.dependency,
                    workflow: { workflowId: task.workflow.workflowId },
                },
            });
        }

        logService.printLog(
            task.taskId,
            `Dependency task "${task.dependency}" completed.`
        );
        return true;
    }
}
