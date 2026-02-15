import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { getAIResponse, saveUserOnboarding } from '../utils/api';
import { Send, Bot, User, Sparkles, CheckCircle } from 'lucide-react';
import Button from '../components/Button';
import { motion, AnimatePresence } from 'framer-motion';

const Onboarding = () => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hi there! I\'m your Zedule assistant. Let\'s get your scheduling page ready. What should we call your business or profile?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const chatEndRef = useRef(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        const aiResponse = await getAIResponse([...messages, userMessage]);

        // Check if AI completed onboarding
        if (aiResponse.includes('complete_onboarding')) {
            try {
                const match = aiResponse.match(/\{.*"action":\s*"complete_onboarding".*\}/s);
                if (match) {
                    const jsonStr = match[0];
                    const parsed = JSON.parse(jsonStr);
                    setMessages(prev => [...prev, { role: 'assistant', content: "Perfect! I've gathered everything I need. Your profile is being created right now." }]);

                    await saveUserOnboarding(auth.currentUser.uid, {
                        businessName: parsed.data.businessName || 'My Business',
                        services: parsed.data.services || [{ name: 'Consultation', duration: 30 }],
                        availability: parsed.data.availability || [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }]
                    });

                    setIsDone(true);
                } else {
                    throw new Error("JSON block not found in AI response");
                }
            } catch (err) {
                console.error("Failed to parse AI completion:", err);
                setMessages(prev => [...prev, { role: 'assistant', content: "I've got all the info! Let's finish up." }]);
                setIsDone(true);
            }
        } else {
            setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        }

        setIsTyping(false);
    };

    if (isDone) {
        return (
            <div className="max-w-xl mx-auto px-4 py-20 flex flex-col items-center text-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-8"
                >
                    <CheckCircle size={48} />
                </motion.div>
                <h1 className="text-4xl font-bold text-slate-900 mb-4">You're all set!</h1>
                <p className="text-xl text-slate-600 mb-10">Your scheduling page is ready. You can now start taking appointments.</p>
                <Button onClick={() => navigate('/dashboard')} size="lg" className="px-12">
                    Go to Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
            <div className="flex items-center gap-3 mb-8 justify-center">
                <Sparkles className="text-primary w-6 h-6 animate-pulse" />
                <h1 className="text-2xl font-bold text-slate-800">Smart Onboarding</h1>
            </div>

            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[600px]">
                {/* Chat Messages */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                    <AnimatePresence>
                        {messages.map((m, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                            >
                                <div className={`flex gap-3 max-w-[85%] ${m.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === 'assistant' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                        {m.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                                    </div>
                                    <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'assistant'
                                        ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                                        : 'bg-primary text-white rounded-tr-none'
                                        }`}>
                                        {m.content}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {isTyping && (
                        <div className="flex gap-2 p-4 text-slate-400 italic text-xs items-center">
                            <Bot size={14} className="animate-bounce" />
                            Zedule is thinking...
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                    <input
                        type="text"
                        className="flex-grow px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                        placeholder="Type your answer..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isTyping}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isTyping}
                        className="bg-primary text-white p-3 rounded-xl hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg active:scale-95"
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>

            <p className="text-center text-slate-400 text-xs mt-6">
                Powered by AI to make your setup effortless.
            </p>
        </div>
    );
};

export default Onboarding;
