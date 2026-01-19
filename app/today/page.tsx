import { TaskDashboard } from '@/components/dashboard/TaskDashboard';

export default function TodayPage() {
    return (
        <div className="h-full bg-zinc-50 dark:bg-zinc-950">
            <TaskDashboard view="today" />
        </div>
    );
}
