// const express = require('express');
// const cors = require('cors');
// const jwt = require('jsonwebtoken');
// require('dotenv').config()
// const port = process.env.PORT || 5000;
// const app = express();
// app.use(cors());
// app.use(express.json())

// // const SECRET_KEY = 'your-secret-key'; // Store securely in environment variables
// // const users = [];

// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://${process.env.DB_user}:${process.env.DB_pass}@cluster0.khtuk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// // Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//     serverApi: {
//         version: ServerApiVersion.v1,
//         strict: true,
//         deprecationErrors: true,
//     }
// });

// async function run() {
//     try {
//         // Connect the client to the server	(optional starting in v4.7)
//         // await client.connect();
//         // Send a ping to confirm a successful connection
//         // await client.db("admin").command({ ping: 1 });
//         console.log("Pinged your deployment. You successfully connected to MongoDB!");
//         const database = client.db('auratasks');
//         usersCollection = database.collection('users');
//         app.post('/jwt', async (req, res) => {
//             const user = req.body;
//             const token = jwt.sign(user, "secrect", { expiresIn: '1h' });
//             res.send(token);
//         })
//         app.post('/register', async (req, res) => {
//             try {
//                 const { displayName, email, password, firstName, lastName, photoURL } = req.body;
//                 const hashedPassword = await bcrypt.hash(password, 10);
//                 const user = { displayName, email, password: hashedPassword, firstName, lastName, photoURL };
//                 users.push(user); // Store in database in production
//                 const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });
//                 res.status(201).json({ message: 'User registered successfully', token });
//             } catch (error) {
//                 res.status(500).json({ error: 'Registration failed' });
//             }
//         });

//         // Login Endpoint
//         app.post('/login', async (req, res) => {
//             try {
//                 const { email, password } = req.body;
//                 const user = users.find(u => u.email === email);
//                 if (!user) return res.status(400).json({ error: 'Invalid credentials' });
//                 const isMatch = await bcrypt.compare(password, user.password);
//                 if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
//                 const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });
//                 res.json({ message: 'Login successful', token, user: { email, displayName: user.displayName } });
//             } catch (error) {
//                 res.status(500).json({ error: 'Login failed' });
//             }
//         });


//         // Protected Route Example
//         app.get('/profile', (req, res) => {
//             const token = req.headers.authorization?.split(' ')[1];
//             if (!token) return res.status(401).json({ error: 'No token provided' });
//             try {
//                 const decoded = jwt.verify(token, SECRET_KEY);
//                 const user = users.find(u => u.email === decoded.email);
//                 res.json(user);
//             } catch (error) {
//                 res.status(401).json({ error: 'Invalid token' });
//             }
//         });
//     }
//     catch (error) {
//         console.log('error connecting to mongodb', errors)
//     }
//     // finally {
//     //     // Ensures that the client will close when you finish/error
//     //     await client.close();
//     // }
// }
// run().catch(console.dir);
// app.get('/', (req, res) => {
//     res.send('SIMPLE CRUD IS RUNNING')
// })
// app.listen(port, () => {
//     console.log(`SIMPLE crud is running on port: ${port}`)

// })
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
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

// Mongoose Schema for Users
const userSchema = new mongoose.Schema({
    displayName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for Google users
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    photoURL: { type: String },
    registrationDate: { type: Date, default: Date.now },
    isGoogleUser: { type: Boolean, default: false }, // Flag for Google Sign-In users
});

const User = mongoose.model('User', userSchema);

// Register Endpoint
app.post('/register', async (req, res) => {
    try {
        const { displayName, email, password, firstName, lastName, photoURL, isGoogleUser } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Hash password (skip for Google users)
        let hashedPassword = null;
        if (password && !isGoogleUser) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Create new user
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

        // Save to MongoDB
        await user.save();

        // Generate JWT
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

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password (skip for Google users)
        if (!user.isGoogleUser) {
            if (!user.password || !password) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }
        }

        // Generate JWT
        const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });

        res.json({
            message: 'Login successful',
            token,
            user: {
                email: user.email,
                displayName: user.displayName,
                firstName: user.firstName,
                lastName: user.lastName,
                photoURL: user.photoURL,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Protected Profile Endpoint
app.get('/profile', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            email: user.email,
            displayName: user.displayName,
            firstName: user.firstName,
            lastName: user.lastName,
            photoURL: user.photoURL,
        });
    } catch (error) {
        console.error('Profile error:', error);
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