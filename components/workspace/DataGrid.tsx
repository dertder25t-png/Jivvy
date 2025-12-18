
'use client';
import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ColDef } from 'ag-grid-community';

// Register modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface MetricRow {
  metric: string;
  value: string;
  confidence: number;
}

export function DataGrid({ data }: { data: MetricRow[] }) {
  const columnDefs = useMemo<ColDef<MetricRow>[]>(() => [
    {
        field: 'metric',
        headerName: 'Metric Name',
        flex: 1,
        filter: true,
        cellClass: "text-zinc-300 text-xs font-medium flex items-center"
    },
    {
        field: 'value',
        headerName: 'Value',
        flex: 1,
        editable: true,
        cellClass: "text-white text-xs font-bold flex items-center"
    },
    {
      field: 'confidence',
      headerName: 'Conf.',
      width: 80,
      cellRenderer: (params: any) => {
         const val = params.value;
         const color = val > 0.8 ? "bg-lime-500" : val > 0.5 ? "bg-amber-500" : "bg-red-500";
         return (
             <div className="flex items-center gap-2 h-full">
                 <div className={`w-2 h-2 rounded-full ${color}`} />
                 <span className="text-[10px] text-zinc-400">{(val * 100).toFixed(0)}%</span>
             </div>
         )
      }
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    suppressMenu: true,
    headerClass: "text-xs font-bold text-zinc-500 uppercase tracking-wider bg-zinc-900 border-b border-zinc-800"
  }), []);

  return (
    <div className="w-full h-[250px] rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-950/50 shadow-inner">
      {/* Custom styles injection for this grid instance to match Soft Pop */}
      <style jsx global>{`
        .ag-theme-alpine-dark {
            --ag-background-color: transparent;
            --ag-header-background-color: rgba(24, 24, 27, 0.5);
            --ag-odd-row-background-color: rgba(255, 255, 255, 0.02);
            --ag-border-color: rgba(255, 255, 255, 0.05);
            --ag-row-border-color: rgba(255, 255, 255, 0.05);
            --ag-foreground-color: #d4d4d8;
            --ag-header-foreground-color: #71717a;
            --ag-header-height: 40px;
            --ag-row-height: 40px;
            --ag-font-size: 12px;
            --ag-font-family: inherit;
        }
        .ag-root-wrapper { border: none !important; border-radius: 24px; }
      `}</style>
      <div className="ag-theme-alpine-dark w-full h-full">
        <AgGridReact<MetricRow>
            rowData={data}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={true}
            rowSelection="single"
        />
      </div>
    </div>
  );
}
