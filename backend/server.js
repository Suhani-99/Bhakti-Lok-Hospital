require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// MONGODB CONNECTION
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ FATAL ERROR: MONGO_URI is not defined in .env file");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.log("❌ MongoDB Connection Error:", err));

// ---------------------------------------------------------
// 1. APPOINTMENT SCHEMA
// ---------------------------------------------------------
const AppointmentSchema = new mongoose.Schema({
    patientName: { type: String, required: true },
    phone: { type: String, required: true },
    age: { type: Number, required: true },
    doctor: { type: String, required: true },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    fee: { type: String, default: "₹500" },
    paymentStatus: { type: String, default: "Pending" },
    type: { type: String, default: "Online" }, 
    transactionId: { type: String },
    symptoms: { type: String },
    medications: { type: String },
    history: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// CHECK IF MODEL EXISTS BEFORE DEFINING
const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema);

// ---------------------------------------------------------
// 2. DOCTOR SCHEMA (Updated for Dual Shifts)
// ---------------------------------------------------------
const DoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    qualifications: { type: String, required: true },
    experience: { type: String, required: true },
    image: { type: String, default: "images/reception.png" },
    bio: { type: String, default: "Highly experienced specialist." },
    isAvailable: { type: Boolean, default: true },
    
    // SHIFT 1 (Morning) - Default 10 AM to 1 PM
    startTime1: { type: String, default: "10:00" }, 
    endTime1: { type: String, default: "13:00" },

    // SHIFT 2 (Evening) - Default 5 PM to 9 PM
    startTime2: { type: String, default: "17:00" },
    endTime2: { type: String, default: "21:00" }
});

const Doctor = mongoose.model('Doctor', DoctorSchema);

// ---------------------------------------------------------
// 3. USER SCHEMA (For Admin/Staff Login)
// ---------------------------------------------------------
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'receptionist', 'doctor'], default: 'receptionist' }
});
const User = mongoose.model('User', UserSchema);

// ---------------------------------------------------------
// AUTH ROUTES (Register & Login)
// ---------------------------------------------------------

// 1. REGISTER (Run this once to create your admin)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        // Encrypt the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save to DB
        const newUser = new User({ username, password: hashedPassword, role });
        await newUser.save();

        res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error registering user" });
    }
});

// 2. LOGIN (Updated with Force Reset Check)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: "User not found" });

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        // --- NEW: Check if it is the default password ---
        const isDefault = (password === "12345");

        // Create Token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } 
        );

        res.json({ 
            token, 
            role: user.role, 
            username: user.username,
            forceReset: isDefault // <--- SEND THIS FLAG
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// ---------------------------------------------------------
// PASSWORD MANAGEMENT ROUTES
// ---------------------------------------------------------

// 1. GET ALL USERS (To list them in the dashboard)
app.get('/api/users', async (req, res) => {
    try {
        // Return only username and role (exclude password!)
        const users = await User.find({}, 'username role'); 
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// 2. CHANGE MY PASSWORD (For the logged-in user)
app.put('/api/change-password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify Old Password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect old password" });

        // Hash New Password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// 3. ADMIN RESET PASSWORD (Force reset for doctors/staff)
app.put('/api/reset-password', async (req, res) => {
    try {
        const { targetUserId, newPassword } = req.body;
        
        // Hash New Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.findByIdAndUpdate(targetUserId, { password: hashedPassword });

        res.json({ message: "User password reset successfully" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// ---------------------------------------------------------
// 4. AUTOMATED SYNC & DOCTOR MANAGEMENT
// ---------------------------------------------------------

// A. The Missing Route (Fixes "Sync Error")
app.post('/api/sync-doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find();
        let createdCount = 0;

        for (const doc of doctors) {
            // Check if login exists
            const existingUser = await User.findOne({ username: doc.name });
            if (!existingUser) {
                // Auto-create login
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash("12345", salt);
                const newUser = new User({ username: doc.name, password: hashedPassword, role: 'doctor' });
                await newUser.save();
                createdCount++;
            }
        }
        res.json({ message: "Sync Complete", count: createdCount });
    } catch (error) {
        res.status(500).json({ error: "Sync failed" });
    }
});

// ---------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------

// --- APPOINTMENTS ---

// Save Appointment
app.post('/api/appointments', async (req, res) => {
    try {
        console.log("📥 Received Appointment Data:", req.body); 

        const newAppointment = new Appointment(req.body);
        const savedAppointment = await newAppointment.save();
        
        res.status(201).json(savedAppointment);
        console.log("📝 Appointment Saved:", savedAppointment.transactionId);
    } catch (error) {
        console.error("Save Error:", error);
        res.status(500).json({ error: "Failed to save appointment", details: error.message });
    }
});

// Get Appointments
app.get('/api/appointments', async (req, res) => {
    try {
        const appointments = await Appointment.find();
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch appointments" });
    }
});

// --- DOCTORS (For Receptionist & Booking Page) ---

// Get All Doctors
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find();
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch doctors" });
    }
});

// Add New Doctor (UPDATED: Auto-Create Login)
app.post('/api/doctors', async (req, res) => {
    try {
        // 1. Create the Doctor Profile
        const newDoctor = new Doctor(req.body);
        await newDoctor.save();

        // 2. AUTOMATICALLY Create the User Login
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("12345", salt); // Default Password
        
        const newUser = new User({ 
            username: req.body.name, 
            password: hashedPassword, 
            role: 'doctor' 
        });
        await newUser.save();

        res.status(201).json(newDoctor);
        console.log("👨‍⚕️ New Doctor & Login Added:", newDoctor.name);
    } catch (error) {
        res.status(500).json({ error: "Failed to add doctor" });
    }
});

// Update Doctor Schedule
app.put('/api/doctors/:id', async (req, res) => {
    try {
        const { isAvailable, startTime1, endTime1, startTime2, endTime2 } = req.body;
        
        const updatedDoctor = await Doctor.findByIdAndUpdate(
            req.params.id, 
            { isAvailable, startTime1, endTime1, startTime2, endTime2 }, 
            { new: true }
        );

        if (!updatedDoctor) {
            return res.status(404).json({ error: "Doctor not found" });
        }

        res.json(updatedDoctor);
        console.log(`🔄 Updated Schedule for: ${updatedDoctor.name}`);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error updating doctor" });
    }
});

// Delete Doctor
app.delete('/api/doctors/:id', async (req, res) => {
    try {
        // Optionally: We could delete the User login here too, but simpler to keep for now
        await Doctor.findByIdAndDelete(req.params.id);
        res.json({ message: "Doctor deleted successfully" });
        console.log("🗑️ Doctor Deleted");
    } catch (error) {
        res.status(500).json({ error: "Failed to delete doctor" });
    }
});

// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});