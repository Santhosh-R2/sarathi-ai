const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const tutorialRoutes = require("./routes/tutorialRoutes");
const assessmentRoutes = require('./routes/assessmentRoutes');
dotenv.config();
connectDB();

const app = express();

app.use(cors()); 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use("/api/users", userRoutes);
app.use("/api/tutorials", tutorialRoutes);
app.use('/api/assessment', assessmentRoutes);

app.get("/", (req, res) => {
    res.send("API is Digital Sarathi AI-Powered Digital Literacy Assistant...");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live on port ${PORT}`);
});

module.exports = app;