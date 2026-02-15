import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, setDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import OpenAI from 'openai';

// NOTE: In a real production app, this should be handled by a backend/Cloud Function
// to keep the API key secure. For this demo, we'll use a placeholder or let the user provide it.
const apiKeyEnv = import.meta.env.VITE_OPENAI_API_KEY;
const hasValidKey = apiKeyEnv && apiKeyEnv !== 'YOUR_OPENAI_KEY_HERE' && apiKeyEnv.trim() !== '';

const openai = hasValidKey ? new OpenAI({
    apiKey: apiKeyEnv,
    dangerouslyAllowBrowser: true // Only for demo/prototype purposes
}) : null;

export const getAIResponse = async (messages) => {
    // Check if API key is missing or placeholder
    if (!openai) {
        console.warn("OpenAI API Key is missing. Using Mock AI mode.");
        const lastMessage = messages[messages.length - 1].content;

        // Simple mock conversation logic for "Everests Painting & Sons"
        if (messages.length <= 2) {
            return `Oh, I see! "${lastMessage}" sounds like a great name. What services do you offer? (e.g. Consulting, Design)`;
        }
        // Detect business name from the beginning of the conversation
        const businessName = messages[1]?.content || "My Business";

        if (messages.length >= 4) {
            return `Awesome! I've got all the info for ${businessName}. Let's get you started!
            
            { "action": "complete_onboarding", "data": { 
                "businessName": "${businessName}", 
                "services": [
                    {"name": "Standard Session", "duration": 60}
                ],
                "availability": [
                    {"dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 3, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 4, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 5, "startTime": "09:00", "endTime": "17:00"}
                ]
            } }`;
        }

        return `Got it. And how long does a standard session usually take? Also, what are your working hours?`;
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are Zedule's AI Onboarding Assistant. Your goal is to help users set up their scheduling profile.
                    IMPORTANT: Focus ONLY on the information provided in the current conversation. Do not assume any details from previous sessions or common business templates unless the user confirms them.
                    
                    You need to collect:
                    1. Name of the business/user.
                    2. Services offered (e.g., "Consultation", "Haircut").
                    3. Duration for each service (in minutes).
                    4. Availability (days and hours).
                    
                    Be friendly, professional, and concise. Once you have enough info, summarize it.
                    Output a special JSON block at the end of the conversation when all data is collected:
                    { "action": "complete_onboarding", "data": { ... } }`
                },
                ...messages
            ],
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("AI Error:", error);
        return "I'm having trouble connecting to my AI brain right now. Can we try again in a moment?";
    }
};

export const saveUserOnboarding = async (userId, data) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        businessName: data.businessName,
        services: data.services,
        isOnboarded: true,
        updatedAt: serverTimestamp()
    });

    // Save availability
    for (const day of data.availability) {
        await addDoc(collection(db, 'availability'), {
            userId: userId,
            dayOfWeek: day.dayOfWeek,
            startTime: day.startTime,
            endTime: day.endTime,
            createdAt: serverTimestamp()
        });
    }
};

export const fetchAppointments = async (userId) => {
    const q = query(collection(db, 'appointments'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createAppointment = async (appointmentData) => {
    return await addDoc(collection(db, 'appointments'), {
        ...appointmentData,
        status: 'booked',
        createdAt: serverTimestamp()
    });
};
export const generateDemoData = async (userId) => {
    const clients = ["Isabela Martinez", "Carlos Thompson", "Maria Rodriguez", "James Wilson", "Elena Smith"];
    const services = ["Strategy Consultation", "Branding Audit", "Quick Check-in"];
    const today = new Date();

    for (let i = 0; i < 5; i++) {
        const appointmentDate = new Date(today);
        appointmentDate.setDate(today.getDate() + i);
        appointmentDate.setHours(10 + i, 0, 0, 0); // Spaced out hours

        await createAppointment({
            userId: userId,
            clientName: clients[i % clients.length],
            clientEmail: `client${i}@example.com`,
            service: services[i % services.length],
            startTime: appointmentDate,
            duration: 60,
            status: 'booked'
        });
    }
};
