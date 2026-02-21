import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const Footer = () => {
    const [user, setUser] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    // Hide footer on Dashboard and Onboarding if logged in
    const hideOnRoutes = ['/dashboard', '/onboarding'];
    if (user && hideOnRoutes.includes(location.pathname)) {
        return null;
    }

    return (
        <footer className="bg-white border-t border-slate-200 py-8 px-6 mt-auto">
            <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:flex-row">
                <p className="text-slate-500 text-sm">
                    Developed by <a href="http://startandgorva.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Start&Go RVA</a> — <span className="font-semibold text-slate-400 italic">v1.0</span>
                </p>
                <div className="flex gap-6 text-sm font-medium text-slate-600">
                    <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
