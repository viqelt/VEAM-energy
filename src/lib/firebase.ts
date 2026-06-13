import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCR7WjKeGthC1qZ0X0YN_zjjqPCOmXTUYk",
  authDomain: "veam-dc2d5.firebaseapp.com",
  projectId: "veam-dc2d5",
  storageBucket: "veam-dc2d5.firebasestorage.app",
  messagingSenderId: "63495408417",
  appId: "1:63495408417:web:23279e82b937b6c6080c60",
  measurementId: "G-K1NN9EHZJP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
