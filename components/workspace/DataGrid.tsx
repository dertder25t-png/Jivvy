
'use client';
import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface MetricRow {
  metric: string;
  value: string;
  confidence: number;
}

import { ColDef } from 'ag-grid-community';

export function DataGrid({ data }: { data: MetricRow[] }) {
  const columnDefs = useMemo<ColDef<MetricRow>[]>(() => [
    { field: 'metric', headerName: 'Metric Name', flex: 1, filter: true },
    { field: 'value', headerName: 'Extracted Value', flex: 1, editable: true },
    {
      field: 'confidence',
      headerName: 'Conf.',
      width: 90,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cellStyle: (params: any) => ({ color: params.value > 0.8 ? '#4ade80' : '#f87171' })
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true
  }), []);

  return (
    <div className="ag-theme-alpine-dark w-full h-[300px] rounded-lg overflow-hidden border border-white/10">
      <AgGridReact<MetricRow>
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={true}
      />
    </div>
  );
}
