import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, addDays, startOfDay, addMinutes, isAfter, isBefore, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Clock, CheckCircle, ChevronLeft, MapPin } from 'lucide-react';
import Button from '../components/Button';

const parseDate = (dateField) => {
    if (!dateField) return new Date();
    if (dateField.seconds) return new Date(dateField.seconds * 1000);
    if (dateField instanceof Date) return dateField;
    if (typeof dateField === 'string') return new Date(dateField);
    return new Date();
};

const Booking = () => {
    const { userId, slug } = useParams();
    const [resolvedUserId, setResolvedUserId] = useState(null);
    const [owner, setOwner] = useState(null);
    const [services, setServices] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedDate, setSelectedDate] = useState(addDays(startOfDay(new Date()), 1));
    const [selectedTime, setSelectedTime] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookingStatus, setBookingStatus] = useState('idle'); // idle, booking, success
    const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '', address: '' });
    const [existingAppointments, setExistingAppointments] = useState([]);
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            console.log("Booking: Fetching data for", { userId, slug });
            setLoading(true);
            try {
                let targetUserId = userId;

                // Resolve slug to userId if necessary
                if (slug) {
                    const cleanedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                    console.log("Booking: Resolving slug", cleanedSlug);
                    const slugQuery = query(collection(db, 'users'), where('slug', '==', cleanedSlug));

                    try {
                        const slugSnap = await getDocs(slugQuery);
                        if (!slugSnap.empty) {
                            targetUserId = slugSnap.docs[0].id;
                            console.log("Booking: Resolved slug to userId", targetUserId);
                        } else {
                            console.error("Booking: Slug not found in Firestore:", cleanedSlug);
                            setLoading(false);
                            return;
                        }
                    } catch (queryErr) {
                        console.error("Booking: Firestore slug query error:", queryErr);
                        setLoading(false);
                        return;
                    }
                }

                if (!targetUserId) {
                    console.warn("Booking: No targetUserId found (neither via direct ID nor slug)");
                    setLoading(false);
                    return;
                }

                setResolvedUserId(targetUserId);

                // Fetch Owner Profile
                console.log("Booking: Fetching owner profile for", targetUserId);
                const ownerRef = doc(db, 'users', targetUserId);
                const ownerSnap = await getDoc(ownerRef);

                if (ownerSnap.exists()) {
                    setOwner(ownerSnap.data());
                    setServices(ownerSnap.data().services || []);
                    console.log("Booking: Owner profile found", ownerSnap.data().businessName);
                } else {
                    console.error("Booking: Owner document does not exist for ID:", targetUserId);
                }

                // Fetch Availability
                const q = query(collection(db, 'availability'), where('userId', '==', targetUserId));
                const availSnap = await getDocs(q);
                setAvailability(availSnap.docs.map(doc => doc.data()));

                // Fetch Existing Appointments
                const appQ = query(
                    collection(db, 'appointments'),
                    where('userId', '==', targetUserId)
                );
                const appSnap = await getDocs(appQ);
                const apps = appSnap.docs
                    .map(doc => {
                        const data = doc.data();
                        const start = parseDate(data.startTime);
                        const duration = data.duration || 30;
                        return {
                            id: doc.id,
                            start,
                            end: addMinutes(start, duration),
                            status: data.status
                        };
                    })
                    .filter(a => a.status !== 'cancelled');
                setExistingAppointments(apps);

                setLoading(false);
            } catch (err) {
                console.error("Booking: General error fetching booking data:", err);
                setLoading(false);
            }
        };
        fetchData();
    }, [userId, slug]);

    const fetchAddressSuggestions = async (query) => {
        if (query.length < 3) {
            setAddressSuggestions([]);
            return;
        }
        setIsSearchingAddress(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`);
            const data = await res.json();
            setAddressSuggestions(data);
        } catch (err) {
            console.error("Address Autocomplete Error:", err);
        } finally {
            setIsSearchingAddress(false);
        }
    };

    const generateTimeSlots = () => {
        if (!selectedService) return [];

        const dayOfWeek = selectedDate.getDay();
        const dayAvail = availability.find(a => a.dayOfWeek === dayOfWeek && a.active !== false);

        if (!dayAvail) return [];

        const slots = [];
        const buffer = owner.bufferTime || 0;
        let current = set(selectedDate, {
            hours: parseInt(dayAvail.startTime.split(':')[0]),
            minutes: parseInt(dayAvail.startTime.split(':')[1]),
            seconds: 0,
            milliseconds: 0
        });
        const end = set(selectedDate, {
            hours: parseInt(dayAvail.endTime.split(':')[0]),
            minutes: parseInt(dayAvail.endTime.split(':')[1]),
            seconds: 0,
            milliseconds: 0
        });

        while (isBefore(current, end)) {
            const slotStart = new Date(current);
            const slotEnd = addMinutes(slotStart, selectedService.duration || 30);

            // Check if slot overlaps with any existing appointment
            const isOccupied = existingAppointments.some(app => {
                return isBefore(slotStart, app.end) && isAfter(slotEnd, app.start);
            });

            if (!isOccupied && isAfter(current, new Date())) {
                slots.push(new Date(current));
            }
            current = addMinutes(current, (selectedService.duration || 30) + buffer);
        }

        return slots;
    };

    const handleBooking = async (e) => {
        e.preventDefault();
        setBookingStatus('booking');
        try {
            await addDoc(collection(db, 'appointments'), {
                userId: resolvedUserId,
                clientName: customerInfo.name,
                clientEmail: customerInfo.email,
                clientPhone: customerInfo.phone,
                clientAddress: customerInfo.address,
                service: selectedService.name,
                startTime: selectedTime,
                duration: selectedService.duration,
                status: 'booked',
                createdAt: serverTimestamp()
            });
            setBookingStatus('success');
        } catch (err) {
            console.error("Booking Error:", err);
            alert("Failed to book appointment.");
            setBookingStatus('idle');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!owner) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
                <h1 className="text-2xl font-bold text-slate-800">User not found</h1>
                <p className="text-slate-500">This scheduling link is invalid or has expired.</p>
            </div>
        );
    }

    if (bookingStatus === 'success') {
        return (
            <div className="max-w-xl mx-auto px-4 py-20 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle size={40} />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Confirmed!</h1>
                <p className="text-slate-600 mb-8">
                    Your appointment with <span className="font-bold text-slate-900">{owner.businessName || owner.name}</span> for {selectedService.name} is scheduled.
                </p>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl w-full text-left space-y-3">
                    <div className="flex items-center gap-3 text-slate-700">
                        <CalendarIcon size={18} className="text-primary" />
                        <span className="font-medium">{format(selectedTime, 'EEEE, MMMM do yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-700">
                        <Clock size={18} className="text-primary" />
                        <span className="font-medium">{format(selectedTime, 'HH:mm')} ({selectedService.duration} min)</span>
                    </div>
                </div>
                <p className="mt-10 text-slate-400 text-sm italic">You will receive an email confirmation shortly.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
                {/* Left Side: Profile Info */}
                <div className="md:w-1/3 bg-slate-900 text-white p-8 md:p-12">
                    <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 overflow-hidden">
                        {owner.photoURL ? <img src={owner.photoURL} alt="" /> : <div className="text-3xl font-black text-primary">{owner.name?.charAt(0)}</div>}
                    </div>
                    <h2 className="text-sm font-bold text-primary uppercase tracking-widest mb-2">{owner.name}</h2>
                    <h1 className="text-3xl font-extrabold mb-4">{owner.businessName || "Booking Page"}</h1>
                    <div className="space-y-4 text-slate-400 text-sm leading-relaxed">
                        <div className="flex items-start gap-2">
                            <Clock size={16} className="mt-1 flex-shrink-0" />
                            <p>Choose a service and time that works best for you.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <MapPin size={16} className="mt-1 flex-shrink-0" />
                            <p>Online / Remote Session</p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Booking Flow */}
                <div className="flex-grow p-8 md:p-12">
                    {!selectedService ? (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-900">Select a Service</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {services.map((s, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedService(s)}
                                        className="text-left p-6 rounded-2xl border-2 border-slate-100 hover:border-primary hover:bg-primary/5 transition-all group"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-lg text-slate-800 group-hover:text-primary transition-colors">{s.name}</span>
                                            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">{s.duration} min</span>
                                        </div>
                                        <p className="text-sm text-slate-500">Professional {s.name.toLowerCase()} session.</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : !selectedTime ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <button
                                onClick={() => setSelectedService(null)}
                                className="inline-flex items-center gap-2 text-primary text-sm font-bold hover:underline mb-4"
                            >
                                <ChevronLeft size={16} /> Back to services
                            </button>

                            <div className="flex flex-col lg:flex-row gap-10">
                                {/* Date Picker */}
                                <div className="flex-grow">
                                    <h3 className="font-bold text-slate-900 mb-6">Select Date</h3>
                                    <div className="grid grid-cols-7 gap-2">
                                        {[...Array(14)].map((_, i) => {
                                            const d = addDays(new Date(), i + 1);
                                            const isSelected = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => setSelectedDate(d)}
                                                    className={`p-3 rounded-xl flex flex-col items-center transition-all ${isSelected ? 'bg-primary text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'
                                                        }`}
                                                >
                                                    <span className="text-[10px] uppercase font-bold opacity-60 text-center">{format(d, 'EEE')}</span>
                                                    <span className="text-lg font-black">{format(d, 'd')}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Time Picker */}
                                <div className="w-full lg:w-48">
                                    <h3 className="font-bold text-slate-900 mb-6">Select Time</h3>
                                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {generateTimeSlots().length > 0 ? (
                                            generateTimeSlots().map((t, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setSelectedTime(t)}
                                                    className="w-full py-3 px-4 rounded-xl border-2 border-slate-100 hover:border-primary hover:text-primary font-bold text-slate-700 transition-all text-sm"
                                                >
                                                    {format(t, 'HH:mm')}
                                                </button>
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No slots available for this day.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <button
                                onClick={() => setSelectedTime(null)}
                                className="inline-flex items-center gap-2 text-primary text-sm font-bold hover:underline mb-4"
                            >
                                <ChevronLeft size={16} /> Change time/date
                            </button>

                            <h3 className="text-2xl font-bold text-slate-900">Your Information</h3>
                            <form onSubmit={handleBooking} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                                    <input
                                        required
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                        placeholder="John Doe"
                                        value={customerInfo.name}
                                        onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                        placeholder="+1 (555) 000-0000"
                                        value={customerInfo.phone}
                                        onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                    />
                                </div>
                                <div className="relative">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Address for Visit</label>
                                    <div className="relative">
                                        <input
                                            required
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                            placeholder="Start typing your address..."
                                            value={customerInfo.address}
                                            onChange={e => {
                                                setCustomerInfo({ ...customerInfo, address: e.target.value });
                                                fetchAddressSuggestions(e.target.value);
                                            }}
                                        />
                                        {isSearchingAddress && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    {addressSuggestions.length > 0 && (
                                        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                            {addressSuggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                                                    onClick={() => {
                                                        setCustomerInfo({ ...customerInfo, address: s.display_name });
                                                        setAddressSuggestions([]);
                                                    }}
                                                >
                                                    <p className="text-sm font-medium text-slate-700">{s.display_name}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6">
                                    <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                                        <p className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-4">Summary</p>
                                        <h4 className="font-bold text-slate-800 text-lg mb-1">{selectedService.name}</h4>
                                        <p className="text-slate-500 text-sm">
                                            {format(selectedTime, 'EEEE, MMMM do')} @ {format(selectedTime, 'HH:mm')}
                                        </p>
                                    </div>
                                    <Button type="submit" size="lg" className="w-full py-4 text-lg shadow-xl" isLoading={bookingStatus === 'booking'}>
                                        Confirm Appointment
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            <p className="text-center mt-12 text-slate-400 text-xs">
                Zedule v1.0 • Easy Scheduling for Experts
            </p>
        </div>
    );
};

// Local Helper for generating time slots (Simplified version of set from date-fns)
function set(date, { hours, minutes, seconds, milliseconds }) {
    const d = new Date(date);
    if (hours !== undefined) d.setHours(hours);
    if (minutes !== undefined) d.setMinutes(minutes);
    if (seconds !== undefined) d.setSeconds(seconds);
    if (milliseconds !== undefined) d.setMilliseconds(milliseconds);
    return d;
}

export default Booking;
