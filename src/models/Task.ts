import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Workflow } from './Workflow';
import { TaskStatus } from '../workers/taskRunner';

@Entity({ name: 'tasks' })
export class Task {
    @PrimaryGeneratedColumn('uuid')
    taskId!: string;

    @Column()
    clientId!: string;

    @Column('text')
    geoJson!: string;

    @Column()
    status!: TaskStatus;

    @Column({ nullable: true, type: 'text' })
    progress?: string | null;

    @Column({ nullable: true })
    resultId?: string;

    @Column()
    taskType!: string;

    @Column({ default: 1 })
    stepNumber!: number;

    @ManyToOne(() => Workflow, (workflow) => workflow.tasks)
    workflow!: Workflow;

    @Column({ nullable: true, type: 'text' })
    dependency?: string; // The task this task depends on
}
