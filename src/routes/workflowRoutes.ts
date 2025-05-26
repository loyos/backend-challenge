import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';

interface WorkflowStatus {
    workflowId: string;
    status: 'in_progress' | 'completed' | 'failed';
    completedTasks: number;
    totalTasks: number;
}

interface WorkflowResult {
    workflowId: string;
    status: 'in_progress' | 'completed' | 'failed';
    finalResult: string | null;
}

const router = Router();

const taskRepository = AppDataSource.getRepository(Task);
const workflowRepository = AppDataSource.getRepository(Workflow);

router.get('/:id/status', async (req: any, res: any) => {
    const { id } = req.params;

    const result: Workflow | null = await workflowRepository.findOne({
        where: { workflowId: id },
        relations: ['tasks'],
    });
    if (!result) {
        return res.status(404).json({ message: 'Workflow not found' });
    }

    try {
        res.status(202).json({
            workflowId: result.workflowId,
            status: result.status,
            completedTasks: result.tasks.filter(
                (task) => task.status === 'completed'
            ).length,
            totalTasks: result.tasks.length,
        });
    } catch (error: any) {
        console.error('Error retrieving workflow status:', error);
        res.status(500).json({ message: 'Failed to retrieve workflow status' });
    }
});

router.get('/:id/results', async (req: any, res: any) => {
    const { id } = req.params;

    try {
        const workflow: Workflow | null = await workflowRepository.findOne({
            where: { workflowId: id },
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found' });
        }

        if (workflow.status !== 'completed') {
            return res.status(400).json({
                message: 'Workflow is not yet completed',
            });
        }

        res.status(200).json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult: workflow.finalResult,
        } as WorkflowResult);
    } catch (error: any) {
        console.error('Error retrieving workflow results:', error);
        res.status(500).json({
            message: 'Failed to retrieve workflow results',
        });
    }
});

export default router;
