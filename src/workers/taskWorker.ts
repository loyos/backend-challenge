import { AppDataSource } from '../data-source';
import { Task } from '../models/Task';
import { TaskRunner, TaskStatus } from './taskRunner';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        console.log('Checking for queued tasks...');

        // Fetch all queued tasks
        const tasks = await taskRepository.find({
            where: { status: TaskStatus.Queued },
            relations: ['workflow'], // Ensure workflow is loaded
            order: { stepNumber: 'ASC' }, // Optional: prioritize by step number
        });

        if (tasks.length > 0) {
            try {
                // Execute all tasks in parallel
                await Promise.all(
                    tasks.map((task) =>
                        taskRunner.run(task).catch((error) => {
                            console.error(
                                `Task execution failed for task ${task.taskId}.`
                            );
                            console.error(error);
                        })
                    )
                );
            } catch (error) {
                console.error('Error executing tasks in parallel:', error);
            }
        } else {
            console.log('No queued tasks found.');
        }

        // Wait before checking for the next batch of tasks
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }
}
