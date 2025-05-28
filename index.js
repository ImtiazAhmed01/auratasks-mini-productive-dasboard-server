const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// JWT Secret Key
const SECRET_KEY = process.env.JWT_SECRET || '4f9kPqW3zT2rY8nJ5vL1bF6hD4gC2aE9';

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.khtuk.mongodb.net/auratasks?retryWrites=true&w=majority`;
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    displayName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    photoURL: { type: String },
    registrationDate: { type: Date, default: Date.now },
    isGoogleUser: { type: Boolean, default: false },
});
const User = mongoose.model('User', userSchema);

// Task Schema
const taskSchema = new mongoose.Schema({
    email: { type: String, required: true }, // Changed from userId
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['To Do', 'In Progress', 'Done'], required: true, default: 'To Do' },
    dueDate: { type: Date },
    priority: { type: String, enum: ['Low', 'Medium', 'High'] },
    order: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
taskSchema.index({ email: 1, order: 1 });
taskSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});
const Task = mongoose.model('Task', taskSchema);

// Goal Schema
const goalSchema = new mongoose.Schema({
    email: { type: String, required: true }, // Changed from userId
    title: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true },
    targetDate: { type: Date },
    status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], required: true, default: 'Not Started' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
goalSchema.index({ email: 1 });
goalSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});
const Goal = mongoose.model('Goal', goalSchema);

// Middleware to Verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Register Endpoint
app.post('/register', async (req, res) => {
    try {
        const { displayName, email, password, firstName, lastName, photoURL, isGoogleUser } = req.body;
        if (!displayName || !email || !firstName || !lastName) {
            return res.status(400).json({ error: 'Required fields missing' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'User with this email already exists' });

        let hashedPassword = null;
        if (password && !isGoogleUser) hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            displayName,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            photoURL,
            registrationDate: new Date(),
            isGoogleUser: !!isGoogleUser,
        });

        await user.save();
        const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { email, displayName, firstName, lastName, photoURL },
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login Endpoint
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        if (!user.isGoogleUser) {
            if (!user.password || !password) return res.status(400).json({ error: 'Invalid credentials' });
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({
            message: 'Login successful',
            token,
            user: { email, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, photoURL: user.photoURL },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Quote Endpoint
app.get('/quote', async (req, res) => {
    try {
        const response = await axios.get('https://zenquotes.io/api/random', { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        console.error('Quote fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch quote' });
    }
});

// Task Endpoints
app.post('/tasks', verifyToken, async (req, res) => {
    try {
        if (!req.body.title || !req.body.status) return res.status(400).json({ error: 'Title and status are required' });

        const maxOrder = await Task.findOne({ email: req.user.email }).sort('-order').select('order');
        const newOrder = maxOrder ? maxOrder.order + 1 : 0;

        const task = new Task({
            email: req.user.email,
            title: req.body.title,
            description: req.body.description,
            status: req.body.status,
            dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
            priority: req.body.priority,
            order: newOrder,
        });
        await task.save();
        res.status(201).json(task);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

app.get('/tasks', verifyToken, async (req, res) => {
    try {
        const tasks = await Task.find({ email: req.user.email }).sort('order');
        res.json(tasks);
    } catch (error) {
        console.error('Fetch tasks error:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.put('/tasks/:id', verifyToken, async (req, res) => {
    try {
        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, email: req.user.email },
            {
                title: req.body.title,
                description: req.body.description,
                status: req.body.status,
                dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
                priority: req.body.priority,
                updatedAt: Date.now(),
            },
            { new: true }
        );
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.delete('/tasks/:id', verifyToken, async (req, res) => {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, email: req.user.email });
        if (!task) return res.status(404).json({ error: 'Task not found' });
        await Task.updateMany(
            { email: req.user.email, order: { $gt: task.order } },
            { $inc: { order: -1 } }
        );
        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

app.post('/tasks/reorder', verifyToken, async (req, res) => {
    try {
        const { tasks } = req.body;
        if (!Array.isArray(tasks)) return res.status(400).json({ error: 'Tasks must be an array' });

        const taskIds = tasks.map(t => t.id);
        const userTasks = await Task.find({ _id: { $in: taskIds }, email: req.user.email });
        if (userTasks.length !== tasks.length) {
            return res.status(400).json({ error: 'Invalid task IDs or unauthorized' });
        }

        const updates = tasks.map(({ id, order }) => ({
            updateOne: {
                filter: { _id: id, email: req.user.email },
                update: { order },
            },
        }));

        await Task.bulkWrite(updates);
        res.json({ message: 'Tasks reordered successfully' });
    } catch (error) {
        console.error('Reorder tasks error:', error);
        res.status(500).json({ error: 'Failed to reorder tasks' });
    }
});

// Goal Endpoints
app.post('/goals', verifyToken, async (req, res) => {
    try {
        if (!req.body.title || !req.body.type || !req.body.status) {
            return res.status(400).json({ error: 'Title, type, and status are required' });
        }
        const goal = new Goal({
            email: req.user.email,
            title: req.body.title,
            description: req.body.description,
            type: req.body.type,
            targetDate: req.body.targetDate ? new Date(req.body.targetDate) : null,
            status: req.body.status,
        });
        await goal.save();
        res.status(201).json(goal);
    } catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({ error: 'Failed to create goal' });
    }
});

app.get('/goals', verifyToken, async (req, res) => {
    try {
        const goals = await Goal.find({ email: req.user.email });
        res.json(goals);
    } catch (error) {
        console.error('Fetch goals error:', error);
        res.status(500).json({ error: 'Failed to fetch goals' });
    }
});

app.put('/goals/:id', verifyToken, async (req, res) => {
    try {
        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, email: req.user.email },
            {
                title: req.body.title,
                description: req.body.description,
                type: req.body.type,
                targetDate: req.body.targetDate ? new Date(req.body.targetDate) : null,
                status: req.body.status,
                updatedAt: Date.now(),
            },
            { new: true }
        );
        if (!goal) return res.status(404).json({ error: 'Goal not found' });
        res.json(goal);
    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

app.delete('/goals/:id', verifyToken, async (req, res) => {
    try {
        const goal = await Goal.findOneAndDelete({ _id: req.params.id, email: req.user.email });
        if (!goal) return res.status(404).json({ error: 'Goal not found' });
        res.json({ message: 'Goal deleted' });
    } catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Profile Endpoint
app.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({
            email: user.email,
            displayName: user.displayName,
            firstName: user.firstName,
            lastName: user.lastName,
            photoURL: user.photoURL,
        });
    } catch (error) {
        console.error('Fetch profile error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Root Route
app.get('/', (req, res) => {
    res.send('SIMPLE CRUD IS RUNNING');
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});