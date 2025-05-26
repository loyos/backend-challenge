import { Job } from './Job';
import { Task } from '../models/Task';
import { area, booleanValid } from '@turf/turf';
import { Feature, Polygon } from 'geojson';

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<string> {
        console.log(`Running area calculation for task ${task.taskId}...`);

        const inputGeometry: Feature<Polygon> = JSON.parse(task.geoJson);

        if (booleanValid(inputGeometry)) {
            // Calculate the area of the input polygon
            const polygonArea: number = area(inputGeometry);
            console.log(
                `Area of the input polygon: ${polygonArea.toFixed(
                    1
                )} square meters`
            );
            return polygonArea.toString();
        } else {
            console.error('Invalid polygon geometry provided.');
            throw new Error('Invalid polygon geometry provided.');
        }
    }
}
