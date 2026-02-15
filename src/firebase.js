import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBe7dadFb0enEtVXrjJbp0KKaL4t5Hvgz4",
    authDomain: "zedule-f4992.firebaseapp.com",
    projectId: "zedule-f4992",
    storageBucket: "zedule-f4992.firebasestorage.app",
    messagingSenderId: "410591336505",
    appId: "1:410591336505:web:6927743703b104307e95e8",
    measurementId: "G-H1J12DQZP1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };
