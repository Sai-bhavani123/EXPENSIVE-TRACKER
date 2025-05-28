
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRSyJMEsl6a7nq8Qp4XAbos8Ah42_7s5Y",
  authDomain: "expensive-tracker-72932.firebaseapp.com",
  projectId: "expensive-tracker-72932",
  storageBucket: "expensive-tracker-72932.firebasestorage.app",
  messagingSenderId: "1001147315796",
  appId: "1:1001147315796:web:8381d7b7dac50d8b945fc1",
  measurementId: "G-R05FB1E3QQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
export { auth, db };


