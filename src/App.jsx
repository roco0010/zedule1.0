import { useEffect } from "react"; // 👈 agrega esto
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Booking from './pages/Booking';

function App() {

    useEffect(() => {
        console.log("TEST ENV:", import.meta.env.VITE_FIREBASE_API_KEY); // 👈 cambia el nombre si tu variable se llama distinto
    }, []);

    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen flex flex-col bg-slate-50">
                <Navbar />
                <main className="flex-grow">
                    <Routes>
                        <Route path="/" element={<Login />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/onboarding" element={<Onboarding />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/book/:userId" element={<Booking />} />
                        <Route path="/b/:slug" element={<Booking />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
}

export default App;
