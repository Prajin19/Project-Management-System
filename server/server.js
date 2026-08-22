import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express'
import { serve } from "inngest/express";
import { inngest, functions } from "./src/inngest"

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());
app.use("/api/inngest", serve({ client: inngest, functions }));

app.get('/', (req, res) => {
    res.send('Hello from the server!');
});

const PORT = process.env.PORT || 5000;   
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
 