'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/ui/risk-badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SampleDataBanner } from '@/components/ui/sample-data-banner';
import { MapPin, Search, RotateCcw, Activity, Briefcase, FilePlus, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CaseItem {
  firNo: string;
  category: string;
  ioName: string;
  date: string;
  beat: string;
  status: 'INVESTIGATION' | 'REGISTERED' | 'CHARGESHEET' | 'PENDING_BAIL';
  heinous: boolean;
}

interface IncidentPin {
  id: string;
  location: string;
  beat: string;
  type: string;
  time: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  io: string;
}

const INITIAL_CASE_QUEUE: CaseItem[] = [
  { firNo: '0014/2026/WF', category: 'Cyber Fraud (IPC 420/IT Act 66D)', ioName: 'PSI Priya Sharma', date: '2026-07-24 14:30', beat: 'Beat #3 (IT Park)', status: 'INVESTIGATION', heinous: false },
  { firNo: '0015/2026/WF', category: 'House Theft (IPC 380)', ioName: 'PI Ramesh Kumar', date: '2026-07-24 11:15', beat: 'Beat #1 (Residential)', status: 'REGISTERED', heinous: false },
  { firNo: '0016/2026/WF', category: 'Grievous Assault (IPC 326)', ioName: 'PSI Venkatesh B', date: '2026-07-23 22:45', beat: 'Beat #5 (Market)', status: 'PENDING_BAIL', heinous: true },
  { firNo: '0017/2026/WF', category: 'Robbery Attempt (IPC 392)', ioName: 'PI Ramesh Kumar', date: '2026-07-23 19:20', beat: 'Beat #2 (Main Rd)', status: 'CHARGESHEET', heinous: true },
  { firNo: '0018/2026/WF', category: 'Vehicle Theft (IPC 379)', ioName: 'PSI Priya Sharma', date: '2026-07-23 16:00', beat: 'Beat #4 (Metro)', status: 'INVESTIGATION', heinous: false },
];

const INCIDENT_PINS: IncidentPin[] = [
  { id: 'PIN-1', location: 'ITPL Main Road, Sector 3', beat: 'Beat #3', type: 'Phishing Scam Hotline Alert', time: '10 mins ago', severity: 'HIGH', io: 'PSI Priya' },
  { id: 'PIN-2', location: 'HOPE Farm Junction', beat: 'Beat #2', type: 'Vehicle Hit-and-Run Reported', time: '35 mins ago', severity: 'MEDIUM', io: 'PI Ramesh' },
  { id: 'PIN-3', location: 'Prashanth Layout, Gate 2', beat: 'Beat #1', type: 'Night Patrol Alarm Trigger', time: '2 hours ago', severity: 'LOW', io: 'SI Venkatesh' },
];

function StationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryStation = searchParams.get('station');

  const [selectedStation, setSelectedStation] = useState('Whitefield PS');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPinBeat, setSelectedPinBeat] = useState<string | null>(null);
  const [caseQueue, setCaseQueue] = useState<CaseItem[]>(INITIAL_CASE_QUEUE);
  const [showRecordsModal, setShowRecordsModal] = useState(false);

  const [inputFirNo, setInputFirNo] = useState('');
  const [inputCategory, setInputCategory] = useState('IPC 379 - Motor Vehicle Theft');
  const [inputIo, setInputIo] = useState('PSI Priya Sharma');
  const [inputBeat, setInputBeat] = useState('Beat #3 (IT Park)');
  const [isHeinous, setIsHeinous] = useState(false);

  useEffect(() => {
    if (queryStation) setSelectedStation(queryStation);
  }, [queryStation]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFirNo) return;
    const newCase: CaseItem = {
      firNo: inputFirNo,
      category: inputCategory,
      ioName: inputIo,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      beat: inputBeat,
      status: 'INVESTIGATION',
      heinous: isHeinous,
    };
    setCaseQueue([newCase, ...caseQueue]);
    setShowRecordsModal(false);
    setInputFirNo('');
    setIsHeinous(false);
  };

  const handleResetFilters = () => {
    setSelectedPinBeat(null);
    setFilterCategory('ALL');
    setSearchQuery('');
  };

  const filteredQueue = caseQueue.filter((c) => {
    if (selectedPinBeat && !c.beat.includes(selectedPinBeat)) return false;
    if (filterCategory === 'HEINOUS' && !c.heinous) return false;
    if (filterCategory === 'PENDING' && c.status !== 'INVESTIGATION' && c.status !== 'REGISTERED') return false;
    if (searchQuery && !c.firNo.toLowerCase().includes(searchQuery.toLowerCase()) && !c.category.toLowerCase().includes(searchQuery.toLowerCase()) && !c.ioName.toLowerCase().includes(searchQuery.toLowerCase()) && !c.beat.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell title="Station Operational Board" scope={`Unit: ${selectedStation}`}>
      {/* HONESTY RULE: beat incidents (INCIDENT_PINS) and the case queue
          (INITIAL_CASE_QUEUE) are hardcoded; "Station Command Live" indicator is
          decorative. Intake-FIR submit is local-only (no api.cases.create call).
          Banner removed once station case data is fetched from a real endpoint. */}
      <SampleDataBanner
        feature="Live beat incidents, case queue, and the intake-FIR submit action"
        pendingSource="Phase 1 wiring of station case data endpoint"
        className="mb-4"
      />
      <div className="mb-6 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-sm font-bold text-foreground">Station Command Live</span>
          <Badge variant="secondary">SHO Duty Desk</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="rounded-md border border-input bg-background px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="Whitefield PS">Whitefield PS</option>
            <option value="Electronic City PS">Electronic City PS</option>
            <option value="Koramangala PS">Koramangala PS</option>
            <option value="HSR Layout PS">HSR Layout PS</option>
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

          <Button size="sm" onClick={() => setShowRecordsModal(true)} className="text-xs">
            <FilePlus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Intake FIR
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Left Side: Beat Incidents */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="rounded-none shadow-none border-border">
            <CardHeader className="pb-2 border-b border-border/50 bg-secondary/20">
              <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold">Live Beat Incidents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {INCIDENT_PINS.map((pin) => (
                <div
                  key={pin.id}
                  className={`rounded-lg border p-3 cursor-pointer hover:bg-muted ${
                    selectedPinBeat === pin.beat ? 'border-primary ring-1 ring-inset ring-primary' : ''
                  }`}
                  onClick={() => setSelectedPinBeat(pin.beat === selectedPinBeat ? null : pin.beat)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-xs text-foreground font-mono">{pin.beat}</span>
                    <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase">{pin.time}</span>
                  </div>
                  <div className="font-semibold text-sm text-foreground line-clamp-1">{pin.type}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <RiskBadge level={pin.severity} className="mr-2 scale-75 origin-left" />
                    <MapPin className="h-3 w-3" /> {pin.location}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Case Queue Table */}
        <Card className="lg:col-span-3 rounded-none shadow-none border-border">
          <div className="flex-none p-4 border-b border-border bg-secondary/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold">Active Investigation Queue</CardTitle>
                <div className="text-sm text-muted-foreground mt-1 font-mono tracking-tight">
                  Filtering {filteredQueue.length} of {caseQueue.length} records
                  {selectedPinBeat && <span className="ml-2 font-bold text-primary">({selectedPinBeat})</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ALL">All Categories</option>
                  <option value="HEINOUS">Heinous Cases Only</option>
                  <option value="PENDING">Pending Investigation</option>
                </select>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FIR No.</TableHead>
                    <TableHead>Category / Sections</TableHead>
                    <TableHead>Assigned IO</TableHead>
                    <TableHead>Beat / Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueue.map((c) => (
                    <TableRow key={c.firNo}>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-mono text-xs font-bold text-primary">{c.firNo}</div>
                        <div className="text-[10px] text-muted-foreground">{c.date}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-sm text-foreground line-clamp-1">{c.category}</div>
                        {c.heinous && <RiskBadge level="CRITICAL" className="mt-1" />}
                      </TableCell>
                      <TableCell className="font-medium text-sm text-foreground whitespace-nowrap">
                        {c.ioName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {c.beat}
                      </TableCell>
                      <TableCell>
                        <RiskBadge level={c.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => router.push('/cases')}>
                          View →
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredQueue.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Queue empty or no cases match filters.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {showRecordsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowRecordsModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl mx-auto"
            >
              <div className="mb-4 border-b pb-4">
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <FilePlus className="h-5 w-5" /> Data Intake (CCTNS Sync)
                </h3>
              </div>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">FIR Number</label>
                  <Input type="text" value={inputFirNo} onChange={(e) => setInputFirNo(e.target.value)} placeholder="e.g. 0019/2026/WF" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Category / Sections</label>
                  <Input type="text" value={inputCategory} onChange={(e) => setInputCategory(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Assigned IO</label>
                  <select value={inputIo} onChange={(e) => setInputIo(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring">
                    <option>PI Ramesh Kumar</option>
                    <option>PSI Priya Sharma</option>
                    <option>PSI Venkatesh B</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Beat / Location</label>
                  <select value={inputBeat} onChange={(e) => setInputBeat(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring">
                    <option>Beat #1 (Residential)</option>
                    <option>Beat #2 (Main Rd)</option>
                    <option>Beat #3 (IT Park)</option>
                    <option>Beat #4 (Metro)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="heinous" checked={isHeinous} onChange={(e) => setIsHeinous(e.target.checked)} className="rounded border-input text-primary focus:ring-primary" />
                  <label htmlFor="heinous" className="text-sm font-bold text-destructive">Flag as Heinous Crime</label>
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
                  <Button variant="outline" type="button" onClick={() => setShowRecordsModal(false)} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" className="w-full sm:w-auto">Ingest Record</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

export default function StationPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading Station Ops...</div>}>
      <StationPageInner />
    </Suspense>
  );
}
