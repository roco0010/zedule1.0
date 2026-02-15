import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import Calendar from '../components/Calendar';
import {
    Users,
    Calendar as CalendarIcon,
    Settings,
    Plus,
    Bell,
    LogOut,
    Clock,
    ExternalLink,
    ChevronRight,
    Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { format, addDays, set } from 'date-fns';
import { generateDemoData, createAppointment } from '../utils/api';
import { X } from 'lucide-react';

const parseDate = (dateField) => {
    if (!dateField) return new Date();
    if (dateField.seconds) return new Date(dateField.seconds * 1000);
    if (dateField instanceof Date) return dateField;
    if (typeof dateField === 'string') return new Date(dateField);
    return new Date();
};

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('calendar'); // 'calendar', 'clients', 'availability'
    const [schedule, setSchedule] = useState([]);
    const [servicesState, setServicesState] = useState([]);
    const [bufferTime, setBufferTime] = useState(0);
    const [slug, setSlug] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u);

                // Listen to appointments - simplified to avoid index requirement for now
                const q = query(
                    collection(db, 'appointments'),
                    where('userId', '==', u.uid)
                );

                // Failsafe timeout
                const timeout = setTimeout(() => {
                    console.warn("Dashboard loading timed out. Forcing UI display.");
                    setLoading(false);
                }, 5000);

                const unsubApps = onSnapshot(q,
                    (snapshot) => {
                        clearTimeout(timeout);
                        console.log("Snapshot received:", snapshot.size, "records");
                        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        // Sort locally to avoid Firebase index requirement
                        apps.sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));
                        setAppointments(apps);
                        setLoading(false);
                    },
                    (error) => {
                        clearTimeout(timeout);
                        console.error("Firestore Error:", error);
                        setLoading(false); // Stop loading even if error occurs
                    }
                );

                // Fetch Availability
                const availQ = query(collection(db, 'availability'), where('userId', '==', u.uid));
                const unsubAvail = onSnapshot(availQ, (snapshot) => {
                    const avail = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // Ensure all 7 days are represented if missing
                    const fullSchedule = [1, 2, 3, 4, 5, 6, 0].map(day => {
                        const existing = avail.find(a => a.dayOfWeek === day);
                        return existing || { dayOfWeek: day, startTime: '09:00', endTime: '17:00', active: false };
                    });
                    setSchedule(fullSchedule);
                });

                // Fetch User Details for services and buffer
                const userRef = doc(db, 'users', u.uid);
                const unsubUser = onSnapshot(userRef, (doc) => {
                    if (doc.exists()) {
                        const data = doc.data();
                        setServicesState(data.services || []);
                        setBufferTime(data.bufferTime || 0);
                        setSlug(data.slug || '');
                    }
                });

                return () => {
                    unsubApps();
                    unsubAvail();
                    unsubUser();
                };
            } else {
                navigate('/login');
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const userRef = doc(db, 'users', user.uid);

            // Basic slug validation
            const cleanedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

            await updateDoc(userRef, {
                services: servicesState,
                bufferTime: bufferTime,
                slug: cleanedSlug,
                updatedAt: serverTimestamp()
            });

            // Update Availability Collection
            for (const day of schedule) {
                if (day.id) {
                    const dayRef = doc(db, 'availability', day.id);
                    await updateDoc(dayRef, {
                        startTime: day.startTime,
                        endTime: day.endTime,
                        active: day.active ?? true
                    });
                } else if (day.active) {
                    await addDoc(collection(db, 'availability'), {
                        userId: user.uid,
                        dayOfWeek: day.dayOfWeek,
                        startTime: day.startTime,
                        endTime: day.endTime,
                        active: true,
                        createdAt: serverTimestamp()
                    });
                }
            }
            alert("Settings saved successfully!");
        } catch (err) {
            console.error("Save Error:", err);
            alert("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const addCustomService = () => {
        setServicesState([...servicesState, { name: 'Custom Session', duration: 45 }]);
    };

    const updateService = (index, field, value) => {
        const newServices = [...servicesState];
        newServices[index][field] = field === 'duration' ? parseInt(value) : value;
        setServicesState(newServices);
    };

    const deleteService = (index) => {
        setServicesState(servicesState.filter((_, i) => i !== index));
    };

    const updateScheduleDay = (index, field, value) => {
        const newSchedule = [...schedule];
        newSchedule[index][field] = value;
        setSchedule(newSchedule);
    };

    const handleLogout = async () => {
        await auth.signOut();
        navigate('/login');
    };

    const [showModal, setShowModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [newApp, setNewApp] = useState({ clientName: '', clientEmail: '', service: 'Consultation', startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm") });

    const handleDemoData = async () => {
        setIsGenerating(true);
        try {
            await generateDemoData(user.uid);
            alert("Demo data generated successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to generate demo data.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreateManual = async (e) => {
        e.preventDefault();
        try {
            await createAppointment({
                userId: user.uid,
                ...newApp,
                startTime: new Date(newApp.startTime)
            });
            setShowModal(false);
            setNewApp({ clientName: '', clientEmail: '', service: servicesState[0]?.name || 'Consultation', startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
        } catch (err) {
            console.error(err);
            alert("Failed to create appointment.");
        }
    };

    const handleCancelAppointment = async (appId) => {
        if (!confirm("Are you sure you want to cancel this appointment?")) return;
        try {
            const appRef = doc(db, 'appointments', appId);
            await updateDoc(appRef, {
                status: 'cancelled',
                updatedAt: serverTimestamp()
            });
            alert("Appointment cancelled successfully.");
        } catch (err) {
            console.error("Cancel Error:", err);
            alert("Failed to cancel appointment.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const upcomingAppointments = appointments.filter(app => parseDate(app.startTime) > new Date() && app.status !== 'cancelled');

    return (
        <div className="min-h-screen bg-slate-50 flex relative">
            {/* Modal Overlay */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900">New Manual Entry</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateManual} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Client Name</label>
                                <input
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                                    value={newApp.clientName || ''}
                                    onChange={e => setNewApp({ ...newApp, clientName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                                    value={newApp.clientEmail || ''}
                                    onChange={e => setNewApp({ ...newApp, clientEmail: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Service Type</label>
                                <select
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none"
                                    value={newApp.service || ''}
                                    onChange={e => setNewApp({ ...newApp, service: e.target.value })}
                                >
                                    {servicesState.map((s, i) => (
                                        <option key={i} value={s.name}>{s.name} ({s.duration} min)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Date & Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                                    value={newApp.startTime || ''}
                                    onChange={e => setNewApp({ ...newApp, startTime: e.target.value })}
                                />
                            </div>
                            <Button type="submit" className="w-full py-3 mt-4">Save Appointment</Button>
                        </form>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
                <div className="p-6 border-b border-slate-100 mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="bg-primary p-1.5 rounded-lg text-white">
                            <CalendarIcon size={18} />
                        </div>
                        <span className="font-bold text-xl">Zedule</span>
                    </div>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Workspace v1.0</p>
                </div>

                <nav className="flex-grow px-4 space-y-2">
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'calendar' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <CalendarIcon size={20} />
                        Calendar
                    </button>
                    <button
                        onClick={() => setActiveTab('clients')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'clients' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Users size={20} className={activeTab === 'clients' ? 'text-primary' : 'group-hover:text-primary'} />
                        Clients
                    </button>
                    <button
                        onClick={() => setActiveTab('availability')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'availability' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Settings size={20} className={activeTab === 'availability' ? 'text-primary' : 'group-hover:text-primary'} />
                        Availability
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 p-2 mb-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                            {user?.photoURL ? <img src={user.photoURL} alt="" /> : <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">{user?.displayName?.charAt(0)}</div>}
                        </div>
                        <div className="flex-grow min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{user?.displayName}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                        <LogOut size={16} />
                        Log Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow flex flex-col min-w-0 h-screen overflow-y-auto">
                <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40 bg-white/80 backdrop-blur-md">
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900">
                            {activeTab === 'calendar' && "Expert Schedule"}
                            {activeTab === 'clients' && "Your Clients"}
                            {activeTab === 'availability' && "Scheduling Settings"}
                        </h1>
                        <p className="text-sm text-slate-500">
                            {activeTab === 'calendar' && "Manage your bookings for today"}
                            {activeTab === 'clients' && "Manage your relationships and history"}
                            {activeTab === 'availability' && "Set your working hours and preferences"}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="sm"
                            className="hidden sm:flex gap-2"
                            onClick={() => window.open(slug ? `/b/${slug}` : `/book/${user.uid}`, '_blank')}
                        >
                            <ExternalLink size={16} />
                            View Public Page
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="hidden sm:flex gap-2 text-slate-500"
                            onClick={handleDemoData}
                            isLoading={isGenerating}
                        >
                            <Sparkles size={16} />
                            Generate Demo
                        </Button>
                        <Button className="gap-2" onClick={() => setShowModal(true)}>
                            <Plus size={18} />
                            New Manual Entry
                        </Button>
                    </div>
                </header>

                <div className="p-8 space-y-8 max-w-7xl">
                    {activeTab === 'calendar' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2">
                                <Calendar appointments={appointments} />
                            </div>
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                            <Clock className="text-primary" size={20} />
                                            Upcoming
                                        </h3>
                                        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full">{upcomingAppointments.length}</span>
                                    </div>
                                    <div className="space-y-4">
                                        {upcomingAppointments.length > 0 ? (
                                            upcomingAppointments.slice(0, 5).map((app) => (
                                                <div key={app.id} className="group p-4 bg-slate-50 rounded-xl border border-transparent hover:border-primary/20 hover:bg-white transition-all cursor-pointer">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <p className="font-bold text-slate-800 leading-none">{app.clientName}</p>
                                                        <span className="text-[10px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                                                            {app.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-1 text-xs text-slate-500 font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1">
                                                                <CalendarIcon size={12} />
                                                                {format(parseDate(app.startTime), 'MMM d')}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Clock size={12} />
                                                                {format(parseDate(app.startTime), 'HH:mm')}
                                                            </div>
                                                        </div>
                                                        {(app.clientPhone || app.clientAddress) && (
                                                            <div className="mt-1 space-y-0.5 border-t border-slate-100 pt-1">
                                                                {app.clientPhone && <p className="truncate text-[10px] text-slate-400">📞 {app.clientPhone}</p>}
                                                                {app.clientAddress && <p className="truncate text-[10px] text-slate-400">📍 {app.clientAddress}</p>}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-end mt-2 pt-2 border-t border-slate-100">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCancelAppointment(app.id);
                                                            }}
                                                            className="text-red-400 hover:text-red-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                                                        >
                                                            Cancel Appointment
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 text-center text-slate-400">
                                                <CalendarIcon size={40} className="mx-auto mb-3 opacity-20" />
                                                <p className="text-sm">No upcoming appointments</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <h4 className="font-bold text-lg mb-2">Zedule Premium</h4>
                                        <p className="text-white/80 text-sm mb-4">Unlock advanced analytics and personalized notifications.</p>
                                        <Button className="bg-white text-primary hover:bg-slate-50 w-full border-none shadow-none font-bold">
                                            Upgrade Plan
                                        </Button>
                                    </div>
                                    <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-white/10 group-hover:rotate-12 transition-transform duration-500" />
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'clients' ? (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-900">Patient & Client Directory</h3>
                                <div className="text-xs text-slate-500 font-medium">Total: {[...new Set(appointments.map(a => a.clientEmail))].length} active</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                                            <th className="px-6 py-4 font-bold">Client Name</th>
                                            <th className="px-6 py-4 font-bold">Contact Email</th>
                                            <th className="px-6 py-4 font-bold">Total Bookings</th>
                                            <th className="px-6 py-4 font-bold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {[...new Set(appointments.map(a => a.clientEmail))].map(email => {
                                            const clientApps = appointments.filter(a => a.clientEmail === email);
                                            const name = clientApps[0]?.clientName;
                                            return (
                                                <tr key={email} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-slate-800">{name}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">{email}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{clientApps.length}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full uppercase">Active</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {appointments.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="py-20 text-center text-slate-400">
                                                    <Users size={40} className="mx-auto mb-3 opacity-20" />
                                                    <p>No client data available yet.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl space-y-8">
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <Settings className="text-primary" size={20} />
                                        Weekly Schedule
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Buffer (min)</label>
                                            <input
                                                type="number"
                                                className="w-16 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-sm font-bold text-primary"
                                                value={bufferTime || 0}
                                                onChange={(e) => setBufferTime(parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {schedule.map((day, idx) => (
                                        <div key={day.dayOfWeek} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${day.active ? 'bg-white border-primary/20 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                            <div className="flex items-center gap-4 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={day.active}
                                                    onChange={(e) => updateScheduleDay(idx, 'active', e.target.checked)}
                                                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                                />
                                                <span className="font-bold text-slate-700 w-24">
                                                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.dayOfWeek]}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="time"
                                                    disabled={!day.active}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 focus:border-primary outline-none disabled:bg-transparent"
                                                    value={day.startTime || '09:00'}
                                                    onChange={(e) => updateScheduleDay(idx, 'startTime', e.target.value)}
                                                />
                                                <span className="text-slate-300">—</span>
                                                <input
                                                    type="time"
                                                    disabled={!day.active}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 focus:border-primary outline-none disabled:bg-transparent"
                                                    value={day.endTime || '17:00'}
                                                    onChange={(e) => updateScheduleDay(idx, 'endTime', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                    <Button onClick={handleSaveSettings} isLoading={isSaving}>Save All Settings</Button>
                                </div>
                            </div>

                            {/* Public Link Slug Settings */}
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <ExternalLink size={20} className="text-primary" />
                                    Public Booking Link
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Personalized Slug</label>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-slate-100 px-4 py-3 rounded-xl border border-slate-200 text-slate-500 font-medium text-sm">
                                                zedule.com/b/
                                            </div>
                                            <input
                                                type="text"
                                                className="flex-grow px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all font-bold text-primary"
                                                placeholder="my-business-name"
                                                value={slug}
                                                onChange={(e) => setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-400">
                                            This is the link you'll share with your clients. Using a slug makes your brand more professional.
                                        </p>
                                    </div>
                                    {slug && (
                                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-center justify-between">
                                            <div className="truncate pr-4">
                                                <span className="text-xs font-bold text-primary/60 block uppercase mb-0.5">Your active link</span>
                                                <code className="text-sm font-bold text-primary block truncate">zedule.com/b/{slug}</code>
                                            </div>
                                            <button
                                                onClick={() => window.open(`/b/${slug}`, '_blank')}
                                                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                                            >
                                                <ExternalLink size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-slate-900">Service Definitions</h3>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={addCustomService}>
                                        <Plus size={16} /> Add Custom Session
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {servicesState.map((service, idx) => (
                                        <div key={idx} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-primary/20 transition-all group">
                                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                                <div className="flex-grow">
                                                    <input
                                                        className="bg-transparent border-b border-transparent focus:border-primary/30 outline-none font-bold text-slate-800 w-full mb-1"
                                                        value={service.name || ''}
                                                        onChange={(e) => updateService(idx, 'name', e.target.value)}
                                                        placeholder="Service Name"
                                                    />
                                                    <p className="text-xs text-slate-400 capitalize">Editable service duration & name</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                                                        <Clock size={14} className="text-slate-400" />
                                                        <input
                                                            type="number"
                                                            className="w-12 bg-transparent outline-none text-sm font-bold text-primary"
                                                            value={service.duration || 30}
                                                            onChange={(e) => updateService(idx, 'duration', e.target.value)}
                                                        />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">min</span>
                                                    </div>
                                                    <button
                                                        onClick={() => deleteService(idx)}
                                                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {servicesState.length === 0 && (
                                        <div className="py-10 text-center text-slate-400 italic">
                                            No services defined. Click "Add Custom Session" to start.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
