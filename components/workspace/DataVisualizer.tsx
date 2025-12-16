'use client';

import { useState } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { BookOpen, Table, ExternalLink, Copy, Check, BarChart3, PieChart } from 'lucide-react';
import { GummyButton } from '@/components/ui/GummyButton';
import type { ChartData } from '@/utils/local-llm';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

interface DataVisualizerProps {
    data: ChartData;
    onViewSource?: (page: number) => void;
}

export function DataVisualizer({ data, onViewSource }: DataVisualizerProps) {
    const [copied, setCopied] = useState(false);
    const [showTable, setShowTable] = useState(false);
    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>(data.type);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: chartType === 'pie' ? 'right' as const : 'top' as const,
                align: chartType === 'pie' ? 'center' as const : 'center' as const,
                labels: {
                    color: 'rgba(255,255,255,0.7)',
                    boxWidth: 12,
                    font: { size: 10 }
                },
            },
            title: {
                display: true,
                text: data.title,
                color: 'rgba(255,255,255,0.9)',
                font: { size: 14, weight: 'bold' as const },
            },
        },
        scales: chartType !== 'pie' ? {
            x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
            y: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
        } : undefined,
    };

    const chartData = {
        labels: data.labels,
        datasets: data.datasets.map(ds => ({
            ...ds,
            borderColor: ds.backgroundColor,
            borderWidth: 2,
        })),
    };

    /**
     * Convert chart data to HTML table for notebook insertion
     */
    const toHtmlTable = (): string => {
        const rows = data.labels.map((label, i) => {
            const values = data.datasets.map(ds => ds.data[i]).join('</td><td>');
            return `<tr><td>${label}</td><td>${values}</td></tr>`;
        });

        const headers = ['Label', ...data.datasets.map(ds => ds.label)].map(h => `<th>${h}</th>`).join('');

        return `
<table style="width:100%; border-collapse: collapse; margin: 1em 0;">
  <caption style="font-weight: bold; margin-bottom: 0.5em;">${data.title}</caption>
  <thead><tr>${headers}</tr></thead>
  <tbody>${rows.join('')}</tbody>
</table>
<p style="font-size: 0.875em; color: #888;">Source pages: ${data.sourcePages.join(', ')}</p>
    `.trim();
    };

    /**
     * Add to notebook via custom event
     */
    const handleAddToNotebook = () => {
        const htmlContent = toHtmlTable();
        window.dispatchEvent(new CustomEvent('jivvy:insert-to-notebook', {
            detail: { html: htmlContent }
        }));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderChart = () => {
        switch (chartType) {
            case 'bar':
                return <Bar data={chartData} options={chartOptions} />;
            case 'line':
                return <Line data={chartData} options={chartOptions} />;
            case 'pie':
                return <Pie data={chartData} options={chartOptions} />;
            default:
                return <Bar data={chartData} options={chartOptions} />;
        }
    };

    return (
        <div className="bg-zinc-800/50 rounded-2xl border border-white/10 overflow-hidden">
            {/* Chart header */}
            <div className="flex items-center justify-between p-3 border-b border-white/5">
                <span className="text-sm text-zinc-300 font-medium">{data.title}</span>
                <div className="flex items-center gap-1">
                    {/* Chart Type Toggle */}
                    <div className="flex items-center bg-zinc-900/50 rounded-lg p-0.5 mr-2 border border-white/5">
                        <button
                            onClick={() => setChartType('bar')}
                            className={`p-1.5 rounded-md transition-all ${chartType === 'bar' ? 'bg-zinc-700 text-lime-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Bar Chart"
                        >
                            <BarChart3 size={14} />
                        </button>
                        <button
                            onClick={() => setChartType('pie')}
                            className={`p-1.5 rounded-md transition-all ${chartType === 'pie' ? 'bg-zinc-700 text-lime-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Pie Chart"
                        >
                            <PieChart size={14} />
                        </button>
                    </div>

                    <GummyButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowTable(!showTable)}
                        title={showTable ? 'Show Chart' : 'Show Table'}
                    >
                        <Table size={14} />
                    </GummyButton>
                    <GummyButton
                        size="sm"
                        variant="ghost"
                        onClick={handleAddToNotebook}
                        title="Add to Notebook"
                    >
                        {copied ? <Check size={14} className="text-lime-400" /> : <BookOpen size={14} />}
                    </GummyButton>
                </div>
            </div>

            {/* Chart or table view */}
            <div className="p-4">
                {showTable ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-2 px-3 text-zinc-400">Label</th>
                                    {data.datasets.map((ds, i) => (
                                        <th key={i} className="text-right py-2 px-3 text-zinc-400">{ds.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.labels.map((label, i) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td className="py-2 px-3 text-zinc-300">{label}</td>
                                        {data.datasets.map((ds, j) => (
                                            <td key={j} className="text-right py-2 px-3 text-zinc-200 font-mono">
                                                {ds.data[i].toLocaleString()}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="h-64">
                        {renderChart()}
                    </div>
                )}
            </div>

            {/* Summary and sources */}
            <div className="px-4 pb-3 space-y-2">
                <p className="text-xs text-zinc-400">{data.summary}</p>
                <div className="flex flex-wrap gap-1">
                    {data.sourcePages.map(page => (
                        <button
                            key={page}
                            onClick={() => onViewSource?.(page)}
                            className="text-[10px] px-1.5 py-0.5 bg-lime-500/20 text-lime-300 rounded hover:bg-lime-500/30 transition-colors flex items-center gap-1"
                        >
                            p.{page}
                            <ExternalLink size={8} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
