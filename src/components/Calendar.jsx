import React, { useState } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    eachDayOfInterval
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { clsx } from 'clsx';

const parseDate = (dateField) => {
    if (!dateField) return new Date();
    if (dateField.seconds) return new Date(dateField.seconds * 1000);
    if (dateField instanceof Date) return dateField;
    if (typeof dateField === 'string') return new Date(dateField);
    return new Date();
};

const Calendar = ({ appointments = [], onSelectDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-slate-800">
                    {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return (
            <div className="grid grid-cols-7 mb-4">
                {days.map(day => (
                    <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;

        const allDays = eachDayOfInterval({ start: startDate, end: endDate });

        return (
            <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                {allDays.map((d, i) => {
                    const isSelected = isSameDay(d, selectedDate);
                    const isCurrentMonth = isSameMonth(d, monthStart);
                    const hasAppointments = appointments.some(app => isSameDay(parseDate(app.startTime), d));

                    return (
                        <div
                            key={i}
                            className={clsx(
                                "min-h-[100px] p-2 bg-white cursor-pointer transition-all hover:bg-slate-50 relative group",
                                !isCurrentMonth && "bg-slate-50/50 text-slate-300 pointer-events-none",
                                isSelected && "bg-primary/5 ring-1 ring-primary/20 z-10"
                            )}
                            onClick={() => {
                                setSelectedDate(d);
                                onSelectDate?.(d);
                            }}
                        >
                            <span className={clsx(
                                "text-sm font-semibold w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                                isSelected ? "bg-primary text-white" : "text-slate-600 group-hover:text-primary",
                                isSameDay(d, new Date()) && !isSelected && "text-primary border border-primary/20"
                            )}>
                                {format(d, 'd')}
                            </span>

                            {hasAppointments && isCurrentMonth && (
                                <div className="mt-2 space-y-1">
                                    {appointments
                                        .filter(app => isSameDay(parseDate(app.startTime), d))
                                        .slice(0, 2)
                                        .map((app, idx) => (
                                            <div key={idx} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 truncate flex items-center gap-1">
                                                <Clock size={8} />
                                                {format(parseDate(app.startTime), 'HH:mm')} - {app.clientName}
                                            </div>
                                        ))
                                    }
                                    {appointments.filter(app => isSameDay(parseDate(app.startTime), d)).length > 2 && (
                                        <div className="text-[9px] text-slate-400 font-medium pl-1">
                                            + {appointments.filter(app => isSameDay(parseDate(app.startTime), d)).length - 2} more
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl">
            {renderHeader()}
            {renderDays()}
            {renderCells()}
        </div>
    );
};

export default Calendar;
