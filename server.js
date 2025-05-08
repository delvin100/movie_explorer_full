const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

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
    }
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

// Add compound index for faster queries
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
    updatedAt: { type: Date, default: Date.now }
});

// Add compound index for faster queries
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
        if (!user) {
            throw new Error();
        }
        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Please authenticate.' });
    }
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
        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }
        const token = jwt.sign({ id: user._id, username: user.username }, 'metflix_secret', { expiresIn: '2h' });
        res.json({ message: 'Login successful.', token, username: user.username });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Get user profile
app.get('/api/profile', auth, async (req, res) => {
    try {
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
        const reviews = await Review.find({ movieId: req.params.movieId })
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Get user's reviews
app.get('/api/user/reviews', auth, async (req, res) => {
    try {
        const reviews = await Review.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
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
            movieId: req.params.movieId
        });

        if (!existingReview) {
            return res.status(404).json({ message: 'Review not found.' });
        }

        existingReview.rating = rating;
        existingReview.review = review;
        existingReview.updatedAt = Date.now();
        await existingReview.save();

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
            movieId: req.params.movieId
        });

        if (!review) {
            return res.status(404).json({ message: 'Review not found.' });
        }

        res.json({ message: 'Review deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));