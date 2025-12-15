
'use client';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TrendChart({ data }: { data: any[] }) {
  // transform your extracted 'metrics' state into chart data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labels: data.map((d: any) => d.metric), // or dates
    datasets: [{
      label: 'Extracted Values',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data.map((d: any) => {
          if (!d.value) return 0;
          // Simple number parsing
          const val = parseFloat(String(d.value).replace(/[^0-9.]/g, ''));
          return isNaN(val) ? 0 : val;
      }),
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  };

  return <div className="h-64"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} /></div>;
}
