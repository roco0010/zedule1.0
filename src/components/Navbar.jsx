import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

const Navbar = () => {
    return (
        <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
            <Link to="/" className="flex items-center gap-2">
                <div className="bg-primary p-2 rounded-lg">
                    <Calendar className="text-white w-6 h-6" />
                </div>
                <span className="text-xl font-bold text-slate-900 tracking-tight">
                    Zedule <span className="text-primary text-sm font-normal">v1.0</span>
                </span>
            </Link>

            <div className="flex items-center gap-4">
                <Link to="/login" className="text-slate-600 hover:text-primary transition-colors font-medium">Login</Link>
                <Link to="/register" className="bg-primary text-white px-5 py-2 rounded-full hover:bg-primary-dark transition-all shadow-md active:scale-95 font-medium">
                    Get Started
                </Link>
            </div>
        </nav>
    );
};

export default Navbar;
