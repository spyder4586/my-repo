'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import { SampleDataBanner } from '@/components/ui/sample-data-banner';
import { api, type SocioCorrelationRow } from '@/lib/api-client';

const DistrictMap = dynamic(
  () => import('@/components/district-map').then((mod) => ({ default: mod.DistrictMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[50vh] min-h-[300px] w-full animate-pulse rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        Loading interactive map...
      </div>
    ),
  }
);
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { MapPin, Search, RotateCcw, PenTool, Activity, Send, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StationRank {
  id: string;
  name: string;
  subDivision: string;
  openCases: number;
  overdueCases: number;
  solveRate: number;
  status: 'EXCELLENT' | 'STABLE' | 'ATTENTION';
  unitId: number;
  lat?: number;
  lng?: number;
}

interface IOOverview {
  id: string;
  name: string;
  designation: string;
  station: string;
  caseCount: number;
  overdueCount: number;
  workload: 'OPTIMAL' | 'BALANCED' | 'HIGH';
}

interface DistrictMeta {
  districtId: number;
  districtName: string;
  lat: number;
  lng: number;
}

// District centroids (mirrors karnataka-districts.geojson) for station point placement.
const DISTRICT_META: DistrictMeta[] = [
  { districtId: 443, districtName: 'Bengaluru Urban',     lat: 12.9716, lng: 77.5946 },
  { districtId: 444, districtName: 'Bengaluru Rural',     lat: 12.8667, lng: 77.7500 },
  { districtId: 445, districtName: 'Mysuru',             lat: 12.2958, lng: 76.6394 },
  { districtId: 446, districtName: 'Belagavi',           lat: 15.8497, lng: 74.4977 },
  { districtId: 447, districtName: 'Kalaburagi',         lat: 17.3297, lng: 76.8343 },
  { districtId: 448, districtName: 'Mangaluru',          lat: 12.9141, lng: 74.8560 },
  { districtId: 449, districtName: 'Hubballi-Dharwad',   lat: 15.3647, lng: 75.1240 },
  { districtId: 450, districtName: 'Davanagere',         lat: 14.4644, lng: 75.9218 },
];

const STATIONS: StationRank[] = [
  { id: 'PS-101', name: 'Whitefield PS', subDivision: 'Whitefield Sub-Div', openCases: 420, overdueCases: 18, solveRate: 84.2, status: 'EXCELLENT', unitId: 60001 },
  { id: 'PS-102', name: 'Electronic City PS', subDivision: 'Electronic City Sub-Div', openCases: 380, overdueCases: 34, solveRate: 76.5, status: 'STABLE', unitId: 60002 },
  { id: 'PS-103', name: 'Koramangala PS', subDivision: 'Madiwala Sub-Div', openCases: 510, overdueCases: 62, solveRate: 68.4, status: 'ATTENTION', unitId: 60003 },
  { id: 'PS-104', name: 'HSR Layout PS', subDivision: 'Madiwala Sub-Div', openCases: 290, overdueCases: 12, solveRate: 88.0, status: 'EXCELLENT', unitId: 60004 },
  { id: 'PS-105', name: 'Marathahalli PS', subDivision: 'Whitefield Sub-Div', openCases: 460, overdueCases: 48, solveRate: 71.0, status: 'ATTENTION', unitId: 60001 },
  { id: 'PS-106', name: 'Indiranagar PS', subDivision: 'Halasuru Sub-Div', openCases: 240, overdueCases: 8, solveRate: 91.5, status: 'EXCELLENT', unitId: 60003 },
];

const INVESTIGATORS: IOOverview[] = [
  { id: 'IO-201', name: 'Inspector Ramesh Kumar', designation: 'PI', station: 'Whitefield PS', caseCount: 14, overdueCount: 1, workload: 'OPTIMAL' },
  { id: 'IO-202', name: 'Sub-Inspector Priya Sharma', designation: 'PSI', station: 'Koramangala PS', caseCount: 26, overdueCount: 6, workload: 'HIGH' },
  { id: 'IO-203', name: 'Sub-Inspector Venkatesh B', designation: 'PSI', station: 'Electronic City PS', caseCount: 19, overdueCount: 2, workload: 'BALANCED' },
  { id: 'IO-204', name: 'Inspector Sunitha Rao', designation: 'PI', station: 'HSR Layout PS', caseCount: 12, overdueCount: 0, workload: 'OPTIMAL' },
  { id: 'IO-205', name: 'Sub-Inspector Anand Patil', designation: 'PSI', station: 'Marathahalli PS', caseCount: 28, overdueCount: 7, workload: 'HIGH' },
];

function DistrictPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryDistrict = searchParams.get('district');

  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(443);
  const [selectedDistrict, setSelectedDistrict] = useState('Bengaluru Urban');
  const [selectedSubDiv, setSelectedSubDiv] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStationFilter, setSelectedStationFilter] = useState<string | null>(null);

  // Real case data (Phase 1.1): fetched from api.cases.list() (mock-fallback in dev).
  const [cases, setCases] = useState<any[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);

  // Phase 2.2: real socio-economic correlation data (joins case counts to Census
  // reference data + computes Pearson r). Replaces the hardcoded socio-eco tab.
  const [socioData, setSocioData] = useState<SocioCorrelationRow[]>([]);
  const [socioLoading, setSocioLoading] = useState(true);

  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [directiveSubject, setDirectiveSubject] = useState('');
  const [directiveTarget, setDirectiveTarget] = useState('Whitefield PS');
  const [directivePriority, setDirectivePriority] = useState('HIGH');
  const [directiveDesc, setDirectiveDesc] = useState('');

  // Fetch real case records on mount (falls back to mock-api in dev).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCasesLoading(true);
      setCasesError(null);
      try {
        const data = await api.cases.list();
        if (!cancelled) setCases(data);
      } catch (err) {
        if (!cancelled) setCasesError(err instanceof Error ? err.message : 'Failed to load cases');
      } finally {
        if (!cancelled) setCasesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Phase 2.2: fetch socio-economic correlation data on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSocioLoading(true);
      try {
        const data = await api.analytics.socioCorrelation();
        if (!cancelled) setSocioData(data);
      } catch {
        if (!cancelled) setSocioData([]);
      } finally {
        if (!cancelled) setSocioLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync district id <-> name from URL param or map clicks.
  useEffect(() => {
    if (queryDistrict) {
      const meta = DISTRICT_META.find((d) => d.districtName === queryDistrict);
      if (meta) {
        setSelectedDistrictId(meta.districtId);
        setSelectedDistrict(meta.districtName);
      } else {
        setSelectedDistrict(queryDistrict);
      }
    }
  }, [queryDistrict]);

  const handleDistrictSelect = (districtId: number, districtName: string) => {
    setSelectedDistrictId(districtId);
    setSelectedDistrict(districtName);
    setSelectedStationFilter(null);
  };

  // Cases within the selected district (real filter on fetched data).
  const districtCases = useMemo(() => {
    if (selectedDistrictId == null) return cases;
    return cases.filter((c) => c.DistrictID === selectedDistrictId);
  }, [cases, selectedDistrictId]);

  // Station points derived from real case data: aggregate by PoliceStationID, use
  // the district centroid as the marker location (station lat/lng not in seed).
  const stationPoints = useMemo(() => {
    const byUnit = new Map<number, number>();
    for (const c of districtCases) {
      const uid = c.PoliceStationID;
      if (uid != null) byUnit.set(uid, (byUnit.get(uid) ?? 0) + 1);
    }
    const meta = DISTRICT_META.find((d) => d.districtId === selectedDistrictId);
    if (!meta) return [];
    return Array.from(byUnit.entries()).map(([unitId, count], i) => ({
      unitId,
      name: `Unit ${unitId}`,
      lat: meta.lat + (i - byUnit.size / 2) * 0.03,
      lng: meta.lng + (i - byUnit.size / 2) * 0.03,
      caseCount: count,
    }));
  }, [districtCases, selectedDistrictId]);

  // Incident points from real case lat/lng for hotspot context overlay.
  const incidentPoints = useMemo(
    () =>
      districtCases
        .filter((c) => typeof c.Latitude === 'number' && typeof c.Longitude === 'number')
        .map((c) => ({ lat: c.Latitude, lng: c.Longitude, label: c.BriefFacts })),
    [districtCases],
  );

  // Choropleth intensity = case count per district / max, for color shading.
  const intensityByDistrict = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const c of cases) {
      const did = c.DistrictID;
      if (did != null) counts[did] = (counts[did] ?? 0) + 1;
    }
    const max = Math.max(1, ...Object.values(counts));
    const out: Record<number, number> = {};
    for (const [did, n] of Object.entries(counts)) out[Number(did)] = n / max;
    return out;
  }, [cases]);

  const filteredStations = STATIONS.filter((s) => {
    if (selectedSubDiv !== 'ALL' && s.subDivision !== selectedSubDiv) return false;
    if (selectedStationFilter && s.name !== selectedStationFilter) return false;
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.subDivision.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredIOs = INVESTIGATORS.filter((io) => {
    if (selectedStationFilter && io.station !== selectedStationFilter) return false;
    if (searchQuery && !io.name.toLowerCase().includes(searchQuery.toLowerCase()) && !io.station.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleDirectiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowDirectiveModal(false);
    setDirectiveSubject('');
    setDirectiveDesc('');
  };

  const handleResetFilters = () => {
    setSelectedDistrictId(null);
    setSelectedDistrict('All Districts');
    setSelectedSubDiv('ALL');
    setSelectedStationFilter(null);
    setSearchQuery('');
  };

  return (
    <AppShell title="District Command Dashboard" scope={`District: ${selectedDistrict}`}>
      {/* HONESTY RULE: the interactive district map (Phase 1.1) and the
          socio-economic correlation tab (Phase 2.2) are now LIVE — they fetch
          real case data and join it to Census reference data with a computed
          Pearson r. Station-performance metrics and IO workload still render
          from hardcoded arrays — banner stays until those are wired. */}
      <SampleDataBanner
        feature="Station performance metrics and IO workload"
        pendingSource="aggregate-counts endpoint wiring"
        className="mb-4"
      />

      {/* Top Controls Header */}
      <div className="mb-6 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="flex h-3 w-3 rounded-full bg-primary animate-pulse shrink-0" />
          <span className="text-sm font-bold text-foreground">District Oversight Command</span>
          <Badge variant="secondary">{districtCases.length} cases</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <select
            value={selectedSubDiv}
            onChange={(e) => setSelectedSubDiv(e.target.value)}
            className="rounded-md border border-input bg-background px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Sub-Divisions</option>
            <option value="Whitefield Sub-Div">Whitefield Sub-Div</option>
            <option value="Electronic City Sub-Div">Electronic City Sub-Div</option>
            <option value="Madiwala Sub-Div">Madiwala Sub-Div</option>
            <option value="Halasuru Sub-Div">Halasuru Sub-Div</option>
          </select>

          <div className="relative flex-1 sm:flex-initial min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-full sm:w-48"
            />
          </div>

          <Button variant="outline" size="sm" onClick={handleResetFilters} className="text-xs">
            <RotateCcw className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Reset
          </Button>

          <Button size="sm" onClick={() => setShowDirectiveModal(true)} className="text-xs">
            <PenTool className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Directive
          </Button>
        </div>
      </div>

      {/* Interactive district map (Phase 1.1) — click a polygon to filter cases/stations. */}
      <Card className="mb-6 rounded-none shadow-none border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/20">
          <div>
            <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
              District Boundary Map — Click to Drill Down
            </CardTitle>
            <CardDescription className="text-sm font-bold text-foreground">
              {selectedDistrictId ? `${selectedDistrict} selected (${districtCases.length} cases)` : 'State-wide view — click a district'}
            </CardDescription>
          </div>
          {casesLoading && <span className="text-[10px] text-muted-foreground animate-pulse">Loading cases…</span>}
          {casesError && <span className="text-[10px] text-destructive">{casesError}</span>}
        </CardHeader>
        <CardContent className="p-0">
          <DistrictMap
            selectedDistrictId={selectedDistrictId}
            onDistrictSelect={handleDistrictSelect}
            stationPoints={stationPoints}
            incidentPoints={incidentPoints}
            intensityByDistrict={intensityByDistrict}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Left Side: District Summary */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>District Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold text-foreground">{districtCases.length}</div>
              <div className="text-sm font-medium text-muted-foreground mb-4">Cases in {selectedDistrict}</div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="text-muted-foreground">Total Cases (view)</span>
                  <span className="font-bold">{districtCases.length.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2">
                  <span className="text-muted-foreground">Under Investigation</span>
                  <span className="font-bold text-destructive">
                    {districtCases.filter((c) => c.CaseStatus === 'INVESTIGATION').length}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pb-2">
                  <span className="text-muted-foreground">Stations Active</span>
                  <span className="font-bold">{stationPoints.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive border">
            <CardHeader className="pb-2 bg-destructive/5 rounded-t-xl">
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="rounded-lg border p-3 cursor-pointer hover:bg-muted" onClick={() => setSelectedStationFilter('Koramangala PS')}>
                <div className="font-bold text-sm">Koramangala PS</div>
                <div className="text-xs text-muted-foreground">High overdue cases (62)</div>
              </div>
              <div className="rounded-lg border p-3 cursor-pointer hover:bg-muted" onClick={() => setSelectedStationFilter('Marathahalli PS')}>
                <div className="font-bold text-sm">Marathahalli PS</div>
                <div className="text-xs text-muted-foreground">Low solve rate (71.0%)</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Data Tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="stations" className="w-full">
            <TabsList className="mb-4 w-full justify-start bg-transparent">
              <TabsTrigger value="stations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border rounded-full px-6">
                Station Performance
              </TabsTrigger>
              <TabsTrigger value="investigators" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border rounded-full px-6 ml-2">
                Investigating Officers Workload
              </TabsTrigger>
              <TabsTrigger value="socioeconomic" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border rounded-full px-6 ml-2">
                Socio-Economic Overlays (F8)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stations">
              <Card>
                <CardHeader>
                  <CardTitle>Station Operational Metrics</CardTitle>
                  <CardDescription>Track the performance and case load of subordinate Police Stations.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Station Name</TableHead>
                          <TableHead>Sub-Division</TableHead>
                          <TableHead className="text-right">Open FIRs</TableHead>
                          <TableHead className="text-right">Overdue Cases</TableHead>
                          <TableHead className="text-right">Solve Rate</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStations.map((station) => (
                          <TableRow key={station.id}>
                            <TableCell className="font-bold text-foreground whitespace-nowrap">
                              {station.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">{station.subDivision}</TableCell>
                            <TableCell className="text-right font-bold">{station.openCases}</TableCell>
                            <TableCell className={`text-right font-bold ${station.overdueCases > 15 ? 'text-destructive' : 'text-foreground'}`}>
                              {station.overdueCases}
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-500">{station.solveRate}%</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={station.status === 'ATTENTION' ? 'destructive' : station.status === 'STABLE' ? 'secondary' : 'success'}>
                                {station.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedStationFilter(station.name)}>
                                Drill
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="investigators">
              <Card>
                <CardHeader>
                  <CardTitle>Investigating Officer (IO) Workload & Case Distribution</CardTitle>
                  <CardDescription>Monitor assigned cases and overdue investigations per officer across the district.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Officer Name & Rank</TableHead>
                          <TableHead>Station Unit</TableHead>
                          <TableHead className="text-right">Assigned Cases</TableHead>
                          <TableHead className="text-right">Overdue (60+ Days)</TableHead>
                          <TableHead className="text-center">Workload Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredIOs.map((io) => (
                          <TableRow key={io.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className="font-bold text-foreground">{io.name}</div>
                              <div className="text-[10px] text-muted-foreground">{io.designation} | {io.id}</div>
                            </TableCell>
                            <TableCell className="text-primary font-medium whitespace-nowrap">{io.station}</TableCell>
                            <TableCell className="text-right font-bold">{io.caseCount}</TableCell>
                            <TableCell className={`text-right font-bold ${io.overdueCount > 4 ? 'text-destructive' : 'text-foreground'}`}>
                              {io.overdueCount}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={io.workload === 'OPTIMAL' ? 'success' : io.workload === 'BALANCED' ? 'secondary' : 'destructive'}>
                                {io.workload}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="socioeconomic">
              <Card>
                <CardHeader>
                  <CardTitle>Socio-Economic & Demographic Correlation (Phase 2.2)</CardTitle>
                  <CardDescription>
                    Crime rate vs urbanization % per district, with computed Pearson correlation coefficient.
                    {socioData.length > 0 && socioData[0].pearsonR !== undefined && (
                      <span className="ml-2 font-bold text-primary">Pearson r = {socioData[0].pearsonR}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  {socioLoading ? (
                    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground animate-pulse">
                      Loading socio-economic correlation (joining case counts to Census data)…
                    </div>
                  ) : socioData.length === 0 ? (
                    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                      No socio-economic data available.
                    </div>
                  ) : (
                    <>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              type="number"
                              dataKey="urbanizationPct"
                              name="Urbanization %"
                              domain={[0, 100]}
                              label={{ value: 'Urbanization %', position: 'bottom', offset: 10, fontSize: 11 }}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              type="number"
                              dataKey="crimeCount"
                              name="Crime Count"
                              label={{ value: 'Crime Count', angle: -90, position: 'insideLeft', fontSize: 11 }}
                              tick={{ fontSize: 11 }}
                            />
                            <ZAxis type="number" dataKey="economicIndex" range={[60, 400]} name="Econ Index" />
                            <Tooltip
                              cursor={{ strokeDasharray: '3 3' }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload as SocioCorrelationRow;
                                return (
                                  <div className="rounded-md border border-border bg-background p-2 text-xs shadow-sm">
                                    <div className="font-bold text-foreground">{d.districtName}</div>
                                    <div className="text-muted-foreground">Crime Count: {d.crimeCount}</div>
                                    <div className="text-muted-foreground">Urbanization: {d.urbanizationPct}%</div>
                                    <div className="text-muted-foreground">Literacy: {d.literacyRate}%</div>
                                    <div className="text-muted-foreground">Econ Index: {d.economicIndex}</div>
                                  </div>
                                );
                              }}
                            />
                            <Scatter data={socioData} fill="#2563eb">
                              {socioData.map((_, i) => (
                                <Cell key={i} fill={`hsl(${210 + i * 18}, 70%, 55%)`} />
                              ))}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>

                      {socioData.length < 5 && (
                        <div className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                          ⚠ Sample size is small ({socioData.length} districts). Correlation is indicative only —
                          statistical significance requires more data points.
                        </div>
                      )}

                      <div className="rounded-xl border p-3 sm:p-4 bg-card">
                        <div className="font-bold text-sm mb-3">District-wise Crime vs Socio-Economic Indicators</div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>District</TableHead>
                                <TableHead className="text-right">Crime Count</TableHead>
                                <TableHead className="text-right">Urbanization %</TableHead>
                                <TableHead className="text-right">Literacy %</TableHead>
                                <TableHead className="text-right">Econ Index</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {socioData.map((row) => (
                                <TableRow key={row.districtId}>
                                  <TableCell className="font-bold whitespace-nowrap">{row.districtName}</TableCell>
                                  <TableCell className="text-right font-mono">{row.crimeCount}</TableCell>
                                  <TableCell className="text-right font-mono">{row.urbanizationPct}</TableCell>
                                  <TableCell className="text-right font-mono">{row.literacyRate}</TableCell>
                                  <TableCell className="text-right font-mono">{row.economicIndex}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AnimatePresence>
        {showDirectiveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowDirectiveModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl mx-auto"
            >
              <div className="mb-4 border-b pb-4">
                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                  <PenTool className="h-5 w-5" /> Issue Operational Directive
                </h3>
              </div>
              <form onSubmit={handleDirectiveSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Target Subordinate</label>
                  <select
                    value={directiveTarget} onChange={(e) => setDirectiveTarget(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
                  >
                    {STATIONS.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Subject</label>
                  <Input type="text" value={directiveSubject} onChange={(e) => setDirectiveSubject(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Instructions</label>
                  <textarea
                    value={directiveDesc} onChange={(e) => setDirectiveDesc(e.target.value)} required
                    className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
                  <Button variant="outline" type="button" onClick={() => setShowDirectiveModal(false)} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" className="w-full sm:w-auto"><Send className="mr-2 h-4 w-4" /> Issue Directive</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

export default function DistrictPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading District Command...</div>}>
      <DistrictPageInner />
    </Suspense>
  );
}
