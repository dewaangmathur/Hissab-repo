import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAZUnYkER9s0OJt4GmO26EY3y12K29lHQw",
  authDomain: "hissab-counter.firebaseapp.com",
  databaseURL: "https://hissab-counter-default-rtdb.firebaseio.com",
  projectId: "hissab-counter",
  storageBucket: "hissab-counter.firebasestorage.app",
  messagingSenderId: "300651080364",
  appId: "1:300651080364:web:d08f6f4828d3010a75cd09",
  measurementId: "G-KPT4GTVGJM",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
