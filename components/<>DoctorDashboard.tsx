import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Activity, 
  Users, 
  AlertTriangle, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut,
  Heart,
  Search,
  Filter,
  UserPlus,
  Loader2,
  Bell
} from 'lucide-react';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { patientsAPI, vitalsAPI, alertsAPI } from '../utils/api';
import { toast } from 'sonner@2.0.3';

interface DoctorDashboardProps {
  user: { id: string; name: string; role: string; email: string };
  onNavigate: (page: 'dashboard' | 'add-reading' | 'alerts' | 'analytics' | 'settings') => void;
  onLogout: () => void;
}

export default function DoctorDashboard({ user, onNavigate, onLogout }: DoctorDashboardProps) {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientVitals, setPatientVitals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState<'patients' | 'alerts' | 'reports' | 'settings'>('patients');
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadPatients();
    loadAlerts();
    
    // Check for new critical alerts every 30 seconds
    const alertInterval = setInterval(loadAlerts, 30000);
    
    return () => clearInterval(alertInterval);
  }, []);

  const loadPatients = async () => {
    try {
      const { patients: patientsList } = await patientsAPI.getAll();
      
      // Fetch latest vitals for each patient
      const patientsWithVitals = await Promise.all(
        (patientsList || []).map(async (patient: any) => {
          try {
            const { vitals } = await vitalsAPI.getForPatient(patient.id, 1);
            const latestVital = vitals && vitals.length > 0 ? vitals[0] : null;
            
            const getStatus = (vital: any) => {
              if (!vital) return 'normal';
              const hrAbnormal = vital.heartRate && (vital.heartRate < 60 || vital.heartRate > 100);
              const o2Abnormal = vital.oxygenLevel && vital.oxygenLevel < 95;
              const tempAbnormal = vital.temperature && (vital.temperature < 36.1 || vital.temperature > 37.2);
              return (hrAbnormal || o2Abnormal || tempAbnormal) ? 'abnormal' : 'normal';
            };

            const getTimeAgo = (timestamp: string) => {
              const now = new Date();
              const then = new Date(timestamp);
              const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
              
              if (diff < 60) return 'Just now';
              if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
              if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
              return `${Math.floor(diff / 86400)} days ago`;
            };
            
            return {
              ...patient,
              heartRate: latestVital?.heartRate || 0,
              bloodPressure: latestVital?.bloodPressure || '0/0',
              spo2: latestVital?.oxygenLevel || 0,
              temperature: latestVital?.temperature || 0,
              status: getStatus(latestVital),
              lastUpdate: latestVital ? getTimeAgo(latestVital.timestamp) : 'No data'
            };
          } catch (error) {
            console.error(`Error loading vitals for patient ${patient.id}:`, error);
            return {
              ...patient,
              heartRate: 0,
              bloodPressure: '0/0',
              spo2: 0,
              temperature: 0,
              status: 'normal',
              lastUpdate: 'No data'
            };
          }
        })
      );

      setPatients(patientsWithVitals);
    } catch (error: any) {
      console.error('Error loading patients:', error);
      if (error.message !== 'API request failed') {
        toast.error('Failed to load patients');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const { alerts } = await alertsAPI.getAll();
      const unacknowledgedAlerts = (alerts || []).filter((a: any) => !a.acknowledged);
      const critical = unacknowledgedAlerts.filter((a: any) => a.severity === 'critical');
      
      setAlertCount(unacknowledgedAlerts.length);
      
      // Check for new critical alerts and show notifications
      if (critical.length > criticalAlerts.length) {
        const newAlerts = critical.slice(0, critical.length - criticalAlerts.length);
        newAlerts.forEach((alert: any) => {
          toast.error(`Critical Alert: ${alert.patientName} - ${alert.message}`, {
            duration: 10000,
            action: {
              label: 'View',
              onClick: () => onNavigate('alerts')
            }
          });
          
          // Show browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Critical Patient Alert', {
              body: `${alert.patientName}: ${alert.message}`,
              icon: '/favicon.ico',
              tag: alert.id
            });
          }
        });
      }
      
      setCriticalAlerts(critical);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const handleAssignDoctor = async (patientId: string) => {
    try {
      await patientsAPI.assignDoctor(patientId, user.id);
      toast.success('Successfully assigned to patient');
      loadPatients();
    } catch (error) {
      console.error('Error assigning doctor:', error);
      toast.error('Failed to assign doctor');
    }
  };

  const handleUnassignDoctor = async (patientId: string) => {
    try {
      await patientsAPI.assignDoctor(patientId, '');
      toast.success('Successfully unassigned from patient');
      loadPatients();
    } catch (error) {
      console.error('Error unassigning doctor:', error);
      toast.error('Failed to unassign doctor');
    }
  };

  const handleViewPatientDetails = async (patient: any) => {
    setSelectedPatient(patient);
    try {
      const { vitals } = await vitalsAPI.getForPatient(patient.id, 10);
      setPatientVitals(vitals || []);
    } catch (error) {
      console.error('Error loading patient vitals:', error);
      setPatientVitals([]);
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const normalPatients = patients.filter(p => p.status === 'normal').length;
  const abnormalPatients = patients.filter(p => p.status === 'abnormal').length;

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Process patient vitals for chart
  const patientDetailData = patientVitals.slice(0, 6).reverse().map((vital, index) => {
    const [sys, dia] = vital.bloodPressure ? vital.bloodPressure.split('/').map((v: string) => parseInt(v)) : [0, 0];
    return {
      time: index === patientVitals.length - 1 ? 'Now' : `Reading ${index + 1}`,
      hr: vital.heartRate || 0,
      bp: sys,
      spo2: vital.oxygenLevel || 0,
      temp: vital.temperature || 0
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-slate-900">HealthMonitor</h2>
              <p className="text-xs text-slate-600">Doctor Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActivePage('patients')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activePage === 'patients'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Patients</span>
            {patients.length > 0 && (
              <Badge className="ml-auto bg-slate-200 text-slate-700">
                {patients.length}
              </Badge>
            )}
          </button>

          <button
            onClick={() => onNavigate('alerts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activePage === 'alerts'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span>Alerts</span>
            {alertCount > 0 && (
              <Badge className="ml-auto bg-red-500 hover:bg-red-600 animate-pulse">
                {alertCount}
              </Badge>
            )}
          </button>

          <button
            onClick={() => onNavigate('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activePage === 'reports'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Reports</span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activePage === 'settings'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-600 truncate">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-slate-900 mb-2">Patient Monitoring Dashboard</h1>
            <p className="text-slate-600">Monitor and manage patient health data in real-time</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-slate-600">Total Patients</CardTitle>
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-900">{patients.length}</p>
                <p className="text-xs text-slate-500 mt-1">Active monitoring</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-slate-600">Normal Status</CardTitle>
                  <Heart className="w-5 h-5 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-900">{normalPatients}</p>
                <p className="text-xs text-emerald-600 mt-1">All vitals normal</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-red-50 border-red-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-red-900">Critical Alerts</CardTitle>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-red-900">{alertCount}</p>
                <p className="text-xs text-red-700 mt-1">
                  {criticalAlerts.length} critical, {alertCount - criticalAlerts.length} warnings
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search patients..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700"
              onClick={() => onNavigate('add-reading')}
            >
              Add Reading
            </Button>
          </div>

          {/* Patients Table */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Patient List</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-slate-600">Loading patients...</p>
                </div>
              ) : patients.length === 0 ? (
                <div className="py-20 text-center">
                  <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No patients found</p>
                  <p className="text-sm text-slate-500 mt-2">Patients will appear here once they sign up</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient Name</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Heart Rate</TableHead>
                      <TableHead>Blood Pressure</TableHead>
                      <TableHead>SpO₂</TableHead>
                      <TableHead>Temperature</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell>{patient.name}</TableCell>
                        <TableCell>{patient.age || 'N/A'}</TableCell>
                        <TableCell>
                          <span className={patient.heartRate > 100 || patient.heartRate < 60 ? 'text-red-600' : ''}>
                            {patient.heartRate || 'N/A'} {patient.heartRate ? 'bpm' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={patient.bloodPressure.startsWith('14') || patient.bloodPressure.startsWith('15') ? 'text-red-600' : ''}>
                            {patient.bloodPressure}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={patient.spo2 < 95 && patient.spo2 > 0 ? 'text-red-600' : ''}>
                            {patient.spo2 || 'N/A'}{patient.spo2 ? '%' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={patient.temperature > 99 ? 'text-red-600' : ''}>
                            {patient.temperature || 'N/A'}{patient.temperature ? '°F' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          {patient.status === 'normal' ? (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              Normal
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Abnormal
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">{patient.lastUpdate}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewPatientDetails(patient)}
                            >
                              View
                            </Button>
                            {patient.assignedDoctorId === user.id ? (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleUnassignDoctor(patient.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Unassign
                              </Button>
                            ) : !patient.assignedDoctorId ? (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleAssignDoctor(patient.id)}
                              >
                                <UserPlus className="w-4 h-4 mr-1" />
                                Assign
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Assigned
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Patient Detail Modal */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Patient Details: {selectedPatient?.name}</DialogTitle>
            <DialogDescription>
              Age: {selectedPatient?.age || 'N/A'} | Last updated: {selectedPatient?.lastUpdate}
            </DialogDescription>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-6">
              {/* Current Vitals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs text-red-900 mb-1">Heart Rate</p>
                  <p className="text-red-900">{selectedPatient.heartRate || 'N/A'} {selectedPatient.heartRate ? 'bpm' : ''}</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                  <p className="text-xs text-purple-900 mb-1">Blood Pressure</p>
                  <p className="text-purple-900">{selectedPatient.bloodPressure}</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-900 mb-1">SpO₂</p>
                  <p className="text-blue-900">{selectedPatient.spo2 || 'N/A'}{selectedPatient.spo2 ? '%' : ''}</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-xs text-orange-900 mb-1">Temperature</p>
                  <p className="text-orange-900">{selectedPatient.temperature || 'N/A'}{selectedPatient.temperature ? '°F' : ''}</p>
                </div>
              </div>

              {/* Health Chart */}
              {patientDetailData.length > 0 ? (
                <div>
                  <h3 className="text-slate-900 mb-4">Recent Health Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={patientDetailData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="hr" 
                        name="Heart Rate"
                        stroke="#ef4444" 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="spo2" 
                        name="SpO₂"
                        stroke="#3b82f6" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No historical data available for this patient</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => onNavigate('add-reading')}>
                  Add Reading
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => onNavigate('analytics')}>
                  View Full Analytics
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
