const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect('mongodb+srv://delvinvarghese2028:Delvin2806@cluster0.isgjvem.mongodb.net/metflix?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, minlength: 3, maxlength: 32 },
    email: { type: String, required: true, unique: true, match: /.+@.+\..+/ },
    password: { type: String, required: true, minlength: 6 },
    profile: {
        bio: { type: String, default: '' },
        avatar: { type: String, default: '' },
        joinDate: { type: Date, default: Date.now },
        favoriteGenres: [{ type: String }],
        watchTime: { type: Number, default: 0 }
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    lastActiveAt: { type: Date, default: Date.now }
});

// Watchlist Schema
const watchlistSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    movieId: { type: String, required: true },
    title: { type: String, required: true },
    poster: { type: String },
    overview: { type: String },
    addedDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['plan_to_watch', 'watching', 'completed'], default: 'plan_to_watch' }
});

watchlistSchema.index({ userId: 1, movieId: 1 }, { unique: true });

// Review Schema
const reviewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    movieId: { type: String, required: true },
    title: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { 
        type: String, 
        required: true,
        minlength: [3, 'Review must be at least 3 characters long'],
        maxlength: [1000, 'Review cannot exceed 1000 characters']
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false }
});

reviewSchema.index({ userId: 1, movieId: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const Watchlist = mongoose.model('Watchlist', watchlistSchema);
const Review = mongoose.model('Review', reviewSchema);

// Middleware to verify JWT token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, 'metflix_secret');
        const user = await User.findOne({ _id: decoded.id });
        if (!user || user.isDeleted) {
            throw new Error('Invalid user or user is deleted');
        }
        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Please authenticate.' });
    }
};

// Update user activity
const updateUserActivity = async (userId) => {
    await User.findByIdAndUpdate(userId, {
        lastActiveAt: new Date(),
        isActive: true
    });
};

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        if (username.length < 3 || username.length > 32) {
            return res.status(400).json({ message: 'Username must be 3-32 characters.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }
        if (!/.+@.+\..+/.test(email)) {
            return res.status(400).json({ message: 'Invalid email address.' });
        }
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            if (existingUser.username === username) {
                return res.status(400).json({ message: 'Username already exists.' });
            } else {
                return res.status(400).json({ message: 'Email already exists.' });
            }
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`;
        const user = new User({ username, email, password: hashedPassword, profile: { avatar: defaultAvatar } });
        await user.save();
        res.status(201).json({ message: 'Registration successful.' });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error: ' + err.message });
        }
        res.status(500).json({ message: 'Server error.' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        const user = await User.findOne({ username });
        if (!user || user.isDeleted) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }
        await updateUserActivity(user._id);
        const token = jwt.sign({ id: user._id, username: user.username }, 'metflix_secret', { expiresIn: '2h' });
        res.json({ message: 'Login successful.', token, username: user.username });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Get user profile
app.get('/api/profile', auth, async (req, res) => {
    try {
        await updateUserActivity(req.user._id);
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Update user profile
app.patch('/api/profile', auth, async (req, res) => {
    try {
        const { username, bio, avatar } = req.body;
        if (username) {
            if (username.length < 3 || username.length > 32) {
                return res.status(400).json({ message: 'Username must be 3-32 characters.' });
            }
            const existingUser = await User.findOne({ username });
            if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
                return res.status(400).json({ message: 'Username already exists.' });
            }
            req.user.username = username;
        }
        if (bio !== undefined) {
            req.user.profile.bio = bio;
        }
        if (avatar) {
            req.user.profile.avatar = avatar;
        }
        await updateUserActivity(req.user._id);
        await req.user.save();
        res.json({ message: 'Profile updated successfully.', username: req.user.username, bio: req.user.profile.bio, avatar: req.user.profile.avatar });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Add to watchlist
app.post('/api/watchlist', auth, async (req, res) => {
    try {
        const { movieId, title, poster, overview } = req.body;
        const existingItem = await Watchlist.findOne({ userId: req.user._id, movieId });
        
        if (existingItem) {
            return res.status(400).json({ message: 'Movie already in watchlist.' });
        }

        const watchlistItem = new Watchlist({
            userId: req.user._id,
            movieId,
            title,
            poster,
            overview
        });

        await watchlistItem.save();
        await updateUserActivity(req.user._id);
        res.status(201).json({ message: 'Added to watchlist.', watchlistItem });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Movie already in watchlist.' });
        }
        res.status(500).json({ message: 'Server error.' });
    }
});

// Get user's watchlist
app.get('/api/watchlist', auth, async (req, res) => {
    try {
        const watchlist = await Watchlist.find({ userId: req.user._id });
        await updateUserActivity(req.user._id);
        res.json(watchlist);
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Update watchlist item status
app.patch('/api/watchlist/:movieId', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const watchlistItem = await Watchlist.findOne({ 
            userId: req.user._id, 
            movieId: req.params.movieId 
        });

        if (!watchlistItem) {
            return res.status(404).json({ message: 'Watchlist item not found.' });
        }

        watchlistItem.status = status;
        await watchlistItem.save();
        await updateUserActivity(req.user._id);
        res.json({ message: 'Watchlist item updated.', watchlistItem });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Remove from watchlist
app.delete('/api/watchlist/:movieId', auth, async (req, res) => {
    try {
        const watchlistItem = await Watchlist.findOneAndDelete({
            userId: req.user._id,
            movieId: req.params.movieId
        });

        if (!watchlistItem) {
            return res.status(404).json({ message: 'Watchlist item not found.' });
        }

        await updateUserActivity(req.user._id);
        res.json({ message: 'Removed from watchlist.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Add review
app.post('/api/reviews', auth, async (req, res) => {
    try {
        const { movieId, title, rating, review } = req.body;
        
        if (review.length < 3) {
            return res.status(400).json({ message: 'Review must be at least 3 characters long.' });
        }
        
        if (review.length > 1000) {
            return res.status(400).json({ message: 'Review cannot exceed 1000 characters.' });
        }

        const existingReview = await Review.findOne({ 
            userId: req.user._id, 
            movieId 
        });

        if (existingReview) {
            return res.status(400).json({ message: 'You have already reviewed this movie.' });
        }

        const newReview = new Review({
            userId: req.user._id,
            username: req.user.username,
            movieId,
            title,
            rating,
            review
        });

        await newReview.save();
        await updateUserActivity(req.user._id);
        res.status(201).json({ message: 'Review submitted successfully.', review: newReview });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'You have already reviewed this movie.' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error.' });
    }
});

// Get movie reviews
app.get('/api/reviews/:movieId', async (req, res) => {
    try {
        const reviews = await Review.find({ movieId: req.params.movieId, isDeleted: false })
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Get user's reviews
app.get('/api/user/reviews', auth, async (req, res) => {
    try {
        const reviews = await Review.find({ userId: req.user._id, isDeleted: false })
            .sort({ createdAt: -1 });
        await updateUserActivity(req.user._id);
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Update review
app.patch('/api/reviews/:movieId', auth, async (req, res) => {
    try {
        const { rating, review } = req.body;
        const existingReview = await Review.findOne({
            userId: req.user._id,
            movieId: req.params.movieId,
            isDeleted: false
        });

        if (!existingReview) {
            return res.status(404).json({ message: 'Review not found.' });
        }

        existingReview.rating = rating;
        existingReview.review = review;
        existingReview.updatedAt = Date.now();
        await existingReview.save();
        await updateUserActivity(req.user._id);
        res.json({ message: 'Review updated successfully.', review: existingReview });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Delete review
app.delete('/api/reviews/:movieId', auth, async (req, res) => {
    try {
        const review = await Review.findOneAndDelete({
            userId: req.user._id,
            movieId: req.params.movieId,
            isDeleted: false
        });

        if (!review) {
            return res.status(404).json({ message: 'Review not found.' });
        }

        await updateUserActivity(req.user._id);
        res.json({ message: 'Review deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Admin Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, 'metflix_secret');
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        if (password === 'admin123') {
            const token = jwt.sign(
                { isAdmin: true },
                'metflix_secret',
                { expiresIn: '24h' }
            );
            res.json({ token });
        } else {
            res.status(401).json({ message: 'Invalid admin password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Users (Admin)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
        // Update isActive for all users based on lastActiveAt
        await User.updateMany(
            { lastActiveAt: { $lt: fifteenDaysAgo }, isActive: true },
            { isActive: false }
        );
        await User.updateMany(
            { lastActiveAt: { $gte: fifteenDaysAgo }, isActive: false },
            { isActive: true }
        );

        const users = await User.find().select('-password');
        const userStats = await Promise.all(users.map(async (user) => {
            const watchlistCount = await Watchlist.countDocuments({ userId: user._id });
            const reviewCount = await Review.countDocuments({ userId: user._id });
            return {
                ...user.toObject(),
                watchlistCount,
                reviewCount
            };
        }));
        res.json(userStats);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Get User Details (Admin)
app.get('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const watchlist = await Watchlist.find({ userId: user._id });
        const reviews = await Review.find({ userId: user._id });

        res.json({
            ...user.toObject(),
            watchlist,
            reviews
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Error fetching user details' });
    }
});

// Get Dashboard Statistics (Admin)
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const inactiveUsers = await User.countDocuments({ isActive: false });
        const totalReviews = await Review.countDocuments();

        res.json({
            totalUsers,
            activeUsers,
            inactiveUsers,
            totalReviews
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

// Admin: Permanently delete a review by _id
app.delete('/api/admin/reviews/:reviewId', authenticateAdmin, async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ message: 'Review not found.' });
        }
        res.json({ message: 'Review deleted permanently.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));