import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const Navbar = () => {
    const [user, setUser] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    // Hide navbar on Dashboard and Onboarding if logged in
    const hideOnRoutes = ['/dashboard', '/onboarding'];
    if (user && hideOnRoutes.includes(location.pathname)) {
        return null;
    }

    return (
        <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
            <Link to="/" className="flex items-center gap-2">
                <div className="bg-primary p-2 rounded-lg">
                    <Calendar className="text-white w-6 h-6" />
                </div>
                <span className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Zedule <span className="text-primary text-sm font-normal">v3.1</span>
                </span>
            </Link>

            {!user ? (
                <div className="flex items-center gap-4">
                    <Link to="/login" className="text-slate-600 hover:text-primary transition-colors font-medium">Login</Link>
                    <Link to="/register" className="bg-primary text-white px-5 py-2 rounded-full hover:bg-primary-dark transition-all shadow-md active:scale-95 font-medium">
                        Get Started
                    </Link>
                </div>
            ) : (
                <div className="flex items-center gap-4">
                    <Link to="/dashboard" className="text-primary font-bold hover:underline">Go to Dashboard</Link>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
