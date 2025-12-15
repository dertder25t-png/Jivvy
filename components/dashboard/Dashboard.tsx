
'use client';

import React from 'react';
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
import { Line } from 'react-chartjs-2';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

// Register modules
ModuleRegistry.registerModules([AllCommunityModule]);

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardProps {
  metrics: {
    label: string;
    value: string | number;
    trend?: number; // percentage change
  }[];
  trendData?: {
    labels: string[]; // Dates/Files
    datasets: {
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
    }[];
  };
  gridData: Record<string, unknown>[];
  onVerifyRow?: (row: Record<string, unknown>) => void;
}

export const Dashboard = ({ metrics, trendData, gridData, onVerifyRow }: DashboardProps) => {
  // Grid Column Definitions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colDefs: any[] = [
      { field: "file", headerName: "Source File", flex: 1 },
      { field: "metric", headerName: "Metric", flex: 1 },
      { field: "value", headerName: "Value", flex: 1 },
      { field: "page", headerName: "Page", width: 80 },
      {
          field: "verify",
          headerName: "Verify",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cellRenderer: (params: any) => {
              return (
                  <button
                      onClick={() => onVerifyRow && onVerifyRow(params.data)}
                      className="px-3 py-1 bg-lime-400 text-black text-xs rounded-full hover:bg-lime-500 transition-colors"
                  >
                      Check
                  </button>
              );
          },
          width: 100
      }
  ];

  return (
    <div className="flex flex-col gap-8 p-6 bg-surface text-white min-h-screen">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((m, i) => (
          <div key={i} className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 hover:scale-[1.01] transition-transform duration-300">
            <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">{m.label}</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">{m.value}</span>
              {m.trend !== undefined && (
                <span className={`text-sm font-medium ${m.trend >= 0 ? 'text-lime-400' : 'text-red-400'}`}>
                  {m.trend > 0 ? '+' : ''}{m.trend}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Trend View */}
      {trendData && (
        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 h-96">
          <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-4">Trend Analysis</h3>
          <div className="h-full w-full">
            <Line options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top' as const,
                        labels: { color: '#e4e4e7' } // Zinc-200
                    },
                },
                scales: {
                    x: {
                        grid: { color: '#27272a' }, // Zinc-800
                        ticks: { color: '#a1a1aa' } // Zinc-400
                    },
                    y: {
                        grid: { color: '#27272a' },
                        ticks: { color: '#a1a1aa' }
                    }
                }
            }} data={trendData} />
          </div>
        </div>
      )}

      {/* Source Table */}
      <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 h-[500px] flex flex-col">
        <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-4">Source Data</h3>
        <div className="ag-theme-alpine-dark flex-1" style={{ width: '100%', height: '100%' }}>
            {/* Note: In a real app with 'ag-theme-alpine-dark', we need to import the css.
                Since we only installed community modules, we might need to rely on basic styles or custom CSS.
                Ag-Grid v32+ uses a different theming approach (Quartz).
                I'll assume basic styling for now or try to import Quartz if available.
            */}
             <AgGridReact
                rowData={gridData}
                columnDefs={colDefs}
                defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true
                }}
                theme="legacy" // or "ag-theme-quartz-dark" if imported
             />
        </div>
      </div>
    </div>
  );
};
