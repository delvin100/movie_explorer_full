const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const { sendMovieRequestApprovalEmail, sendMovieRequestRejectionEmail, sendWelcomeEmail, sendAccountDeletionEmail } = require('./emailHelper');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('.')); // Serve static files from the current directory

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, minlength: 3, maxlength: 32 },
    email: { type: String, required: true, unique: true, match: /.+@.+\..+/ },
    password: { type: String, required: true, minlength: 6 },
    isAdmin: { type: Boolean, default: false },
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

// Movie Request Schema
const movieRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    movie: { type: String, required: true },
    language: { type: String, required: true },
    quality: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'processing', 'completed', 'rejected'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    response: { type: String, default: '' },
    downloadLink: { type: String }
});

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    feedback: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Watchlist = mongoose.model('Watchlist', watchlistSchema);
const Review = mongoose.model('Review', reviewSchema);
const MovieRequest = mongoose.model('MovieRequest', movieRequestSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Middleware to verify JWT token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        // Check for empty fields
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        // Validate username
        if (username.length < 3 || username.length > 32) {
            return res.status(400).json({ message: 'Username must be 3-32 characters.' });
        }
        if (username.includes(' ') || username.trim() !== username) {
            return res.status(400).json({ message: 'Username cannot contain spaces.' });
        }
        // Validate password
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }
        if (password.includes(' ') || password.trim() !== password) {
            return res.status(400).json({ message: 'Password cannot contain spaces.' });
        }
        // Validate email
        if (!/.+@.+\..+/.test(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }
        // Check for existing user
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            if (existingUser.username === username) {
                return res.status(400).json({ message: 'Username already exists.' });
            } else {
                return res.status(400).json({ message: 'Email already exists.' });
            }
        }
        // Create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`;
        const user = new User({ username, email, password: hashedPassword, profile: { avatar: defaultAvatar } });
        await user.save();

        // Respond to client immediately
        res.status(201).json({ message: 'Registration successful.' });

        // Send welcome email in the background (non-blocking)
        sendWelcomeEmail(email, username).catch(emailError => {
            console.error('Error sending welcome email:', emailError);
        });
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
        // Check for empty fields
        if (!username || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        // Validate username
        if (username.includes(' ') || username.trim() !== username) {
            return res.status(400).json({ message: 'Username cannot contain spaces.' });
        }
        // Validate password
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }
        if (password.includes(' ') || password.trim() !== password) {
            return res.status(400).json({ message: 'Password cannot contain spaces.' });
        }
        // Find user
        const user = await User.findOne({ username });
        if (!user || user.isDeleted) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }
        // Update activity and generate token
        await updateUserActivity(user._id);
        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '2h' });
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        req.admin = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Find admin user
        const admin = await User.findOne({ 
            username: username,
            isAdmin: true,
            isDeleted: false,
            isActive: true
        });

        if (!admin) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        // Verify password
        try {
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid admin credentials' });
            }
        } catch (bcryptError) {
            console.error('Password verification error');
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        // Update last active timestamp
        admin.lastActiveAt = new Date();
        await admin.save();

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: admin._id,
                username: admin.username,
                isAdmin: true 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            token,
            username: admin.username,
            message: 'Admin login successful'
        });
    } catch (error) {
        console.error('Admin login error');
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

        // Find all users except admins
        const users = await User.find({ isAdmin: { $ne: true } }).select('-password');
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

// Search Users (Admin)
app.get('/api/admin/users/search', authenticateAdmin, async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ message: 'Username query parameter is required' });
        }

        // Search users except admins
        const users = await User.find({
            username: { $regex: username, $options: 'i' },
            isAdmin: { $ne: true }
        }).select('-password');

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
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Error searching users' });
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
        const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });
        const totalRequests = await MovieRequest.countDocuments();
        const totalReviews = await Review.countDocuments();

        res.json({
            totalUsers,
            totalRequests,
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

// Submit movie request
app.post('/api/movie-request', auth, async (req, res) => {
    try {
        const { movie, language, quality } = req.body;

        // Validate required fields
        if (!movie || !language || !quality) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required.' 
            });
        }

        // Create new movie request
        const movieRequest = new MovieRequest({
            userId: req.user._id,
            movie,
            language,
            quality,
            status: 'pending'
        });

        const savedRequest = await movieRequest.save();

        // Send response
        return res.status(201).json({
            success: true,
            message: 'Movie request submitted successfully',
            requestId: savedRequest._id
        });

    } catch (err) {
        console.error('Error submitting movie request:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Error submitting movie request' 
        });
    }
});

// Get user's own movie requests
app.get('/api/movie-requests/user', auth, async (req, res) => {
    try {
        const requests = await MovieRequest.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        
        res.json(requests);
    } catch (err) {
        console.error('Error fetching user movie requests:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching your movie requests' 
        });
    }
});

// Get all movie requests (admin only)
app.get('/api/movie-requests', authenticateAdmin, async (req, res) => {
    try {
        const { username, status } = req.query;
        let query = {};
        
        if (username) {
            // Find user by username
            const user = await User.findOne({ username: { $regex: username, $options: 'i' } });
            if (user) {
                query.userId = user._id;
            } else {
                return res.json([]); // Return empty array if no user found
            }
        }

        // Add status filter if provided
        if (status && status !== 'all') {
            query.status = status;
        }

        const requests = await MovieRequest.find(query)
            .sort({ createdAt: -1 })
            .populate('userId', 'username email');
        
        res.json(requests);
    } catch (err) {
        console.error('Error fetching movie requests:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching movie requests' 
        });
    }
});

// Update movie request status
app.patch('/api/movie-request/:id', authenticateAdmin, async (req, res) => {
    try {
        const { status, downloadLink } = req.body;
        const requestId = req.params.id;

        if (!['pending', 'completed', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const request = await MovieRequest.findById(requestId).populate('userId', 'email');
        
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Movie request not found'
            });
        }

        // If status is completed and downloadLink is provided, send email
        if (status === 'completed' && downloadLink) {
            try {
                await sendMovieRequestApprovalEmail(
                    request.userId.email,
                    request.movie,
                    downloadLink
                );
            } catch (emailError) {
                console.error('Error sending approval email:', emailError);
                // Continue with the status update even if email fails
            }
        }

        // If status is rejected, send rejection email and delete the request
        if (status === 'rejected') {
            try {
                // Get the rejection reason
                const reason = req.body.rejectionReason || 'No reason provided';
                
                // Delete the request from database first
                await MovieRequest.findByIdAndDelete(requestId);
                
                // Try to send email, but don't let it block the rejection
                try {
                    await sendMovieRequestRejectionEmail(
                        request.userId.email,
                        request.movie,
                        reason
                    );
                    return res.json({
                        success: true,
                        message: 'Request rejected and deleted successfully'
                    });
                } catch (emailError) {
                    console.error('Error sending rejection email:', emailError);
                    return res.json({
                        success: true,
                        message: 'Request rejected and deleted, but email notification failed'
                    });
                }
            } catch (error) {
                console.error('Error in rejection process:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Error processing rejection'
                });
            }
        }

        // For other statuses, update normally
        const updatedRequest = await MovieRequest.findByIdAndUpdate(
            requestId,
            { 
                status,
                downloadLink: status === 'completed' ? downloadLink : undefined
            },
            { new: true }
        );

        res.json({
            success: true,
            message: 'Request status updated successfully',
            request: updatedRequest
        });

    } catch (err) {
        console.error('Error updating movie request:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating movie request' 
        });
    }
});

// Get a single movie request by ID (admin)
app.get('/api/movie-request/:id', authenticateAdmin, async (req, res) => {
    try {
        const request = await MovieRequest.findById(req.params.id)
            .populate('userId', 'username email');
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        res.json(request);
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Delete a movie request (user or admin)
app.delete('/api/movie-requests/:id', auth, async (req, res) => {
    try {
        const request = await MovieRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        // Only allow the user who made the request or an admin to delete
        if (request.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        await request.deleteOne();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Permanently delete user and all related data
app.delete('/api/profile', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        // Delete all watchlist items
        await Watchlist.deleteMany({ userId });
        // Delete all reviews
        await Review.deleteMany({ userId });
        // Delete all movie requests
        await MovieRequest.deleteMany({ userId });
        // Delete the user
        await User.findByIdAndDelete(userId);
        res.json({ message: 'Account and all related data deleted permanently.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Submit feedback (user)
app.post('/api/feedback', auth, async (req, res) => {
    try {
        const { feedback } = req.body;
        if (!feedback || feedback.length < 3) {
            return res.status(400).json({ message: 'Feedback must be at least 3 characters.' });
        }
        const fb = new Feedback({
            userId: req.user._id,
            username: req.user.username,
            feedback
        });
        await fb.save();
        res.status(201).json({ message: 'Feedback submitted successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Get all feedbacks (admin)
app.get('/api/feedbacks', authenticateAdmin, async (req, res) => {
    try {
        const feedbacks = await Feedback.find().sort({ createdAt: -1 });
        res.json(feedbacks);
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Admin: Permanently delete a user and all related data
app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Get user details before deletion for email notification
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Store user details for email
        const userEmail = user.email;
        const username = user.username;

        // Delete all watchlist items
        await Watchlist.deleteMany({ userId });
        
        // Delete all reviews
        await Review.deleteMany({ userId });
        
        // Delete all movie requests
        await MovieRequest.deleteMany({ userId });
        
        // Delete all feedbacks
        if (typeof Feedback !== 'undefined') {
            await Feedback.deleteMany({ userId });
        }
        
        // Delete the user
        await User.findByIdAndDelete(userId);

        // Send deletion email notification
        try {
            await sendAccountDeletionEmail(userEmail, username);
        } catch (emailError) {
            console.error('Error sending deletion email:', emailError);
            // Continue with the deletion process even if email fails
        }

        res.json({ message: 'User and all related data deleted permanently.' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));