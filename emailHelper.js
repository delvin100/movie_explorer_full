const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
require('dotenv').config({ path: './config.gmail.env' });

const oauth2Client = new OAuth2(
    process.env.ClientID,
    process.env.client_secret,
    process.env.redirect_uri
);

// Set credentials with explicit refresh token
oauth2Client.setCredentials({
    refresh_token: process.env.refresh_token
});

// Function to send movie request approval email
const sendMovieRequestApprovalEmail = async (userEmail, movieName, downloadLink) => {
    try {
        // Get new access token
        const { token } = await oauth2Client.getAccessToken();
        if (!token) {
            throw new Error('Failed to get access token');
        }

        // Create transporter with OAuth2
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false, // use TLS
            auth: {
                type: 'OAuth2',
                user: process.env.emailid,
                clientId: process.env.ClientID,
                clientSecret: process.env.client_secret,
                refreshToken: process.env.refresh_token,
                accessToken: token
            }
        });

        const mailOptions = {
            from: process.env.emailid,
            to: userEmail,
            subject: `Your Movie Request for "${movieName}" is Approved!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e50914; border-radius: 8px;">
                    <h2 style="color: #e50914; text-align: center; margin-bottom: 20px;">Movie Request Approved!</h2>
                    <p>Hello,</p>
                    <p>Great news! Your request for <strong>${movieName}</strong> has been approved.</p>
                    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;">You can now download your movie using the button below:</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${downloadLink}" style="display: inline-block; padding: 12px 24px; background-color: #e50914; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Movie</a>
                    </div>
                    <p>Enjoy your movie!</p>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e50914;">
                        <p style="color: #666;">Best regards,</p>
                        <p style="color: #e50914; font-weight: bold;">The Metflix Team</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

async function sendMovieRequestRejectionEmail(userEmail, movieTitle, reason) {
    try {
        // Get new access token
        const { token } = await oauth2Client.getAccessToken();
        if (!token) {
            throw new Error('Failed to get access token');
        }

        // Create transporter with OAuth2
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false, // use TLS
            auth: {
                type: 'OAuth2',
                user: process.env.emailid,
                clientId: process.env.ClientID,
                clientSecret: process.env.client_secret,
                refreshToken: process.env.refresh_token,
                accessToken: token
            }
        });

        const mailOptions = {
            from: process.env.emailid,
            to: userEmail,
            subject: 'Movie Request Rejected - Metflix',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e50914; border-radius: 8px;">
                    <h2 style="color: #e50914; text-align: center; margin-bottom: 20px;">Movie Request Rejected</h2>
                    <p>Dear User,</p>
                    <p>We regret to inform you that your request for the movie "${movieTitle}" has been rejected.</p>
                    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #e50914; font-weight: bold; margin: 0;">Reason for rejection:</p>
                        <p style="margin: 10px 0 0 0;">${reason}</p>
                    </div>
                    <p>You can submit a new request for a different movie or try again later.</p>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e50914;">
                        <p style="color: #666;">Best regards,</p>
                        <p style="color: #e50914; font-weight: bold;">The Metflix Team</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Rejection email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending rejection email:', error);
        return { success: true, message: 'Request rejected but email notification failed' };
    }
}

async function sendWelcomeEmail(userEmail, username) {
    try {
        // Get new access token
        const { token } = await oauth2Client.getAccessToken();
        if (!token) {
            throw new Error('Failed to get access token');
        }

        // Create transporter with OAuth2
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false, // use TLS
            auth: {
                type: 'OAuth2',
                user: process.env.emailid,
                clientId: process.env.ClientID,
                clientSecret: process.env.client_secret,
                refreshToken: process.env.refresh_token,
                accessToken: token
            }
        });

        const mailOptions = {
            from: process.env.emailid,
            to: userEmail,
            subject: 'Welcome to Metflix!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e50914; border-radius: 8px;">
                    <h2 style="color: #e50914; text-align: center; margin-bottom: 20px;">Welcome to Metflix!</h2>
                    <p>Dear ${username},</p>
                    <p>Thank you for joining Metflix! We're excited to have you on board.</p>
                    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;">With your new account, you can:</p>
                        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                            <li>Browse and discover movies</li>
                            <li>Create and manage your watchlist</li>
                            <li>Write reviews and rate movies</li>
                            <li>Request movies for download</li>
                            <li>Customize your profile</li>
                        </ul>
                    </div>
                    <p>Get started by exploring our collection of movies and adding some to your watchlist!</p>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e50914;">
                        <p style="color: #666;">Best regards,</p>
                        <p style="color: #e50914; font-weight: bold;">The Metflix Team</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Welcome email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw error;
    }
}

async function sendAccountDeletionEmail(userEmail, username) {
    try {
        // Get new access token
        const { token } = await oauth2Client.getAccessToken();
        if (!token) {
            throw new Error('Failed to get access token');
        }

        // Create transporter with OAuth2
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false, // use TLS
            auth: {
                type: 'OAuth2',
                user: process.env.emailid,
                clientId: process.env.ClientID,
                clientSecret: process.env.client_secret,
                refreshToken: process.env.refresh_token,
                accessToken: token
            }
        });

        const mailOptions = {
            from: process.env.emailid,
            to: userEmail,
            subject: 'Your Metflix Account Has Been Deleted',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e50914; border-radius: 8px;">
                    <h2 style="color: #e50914; text-align: center; margin-bottom: 20px;">Account Deletion Notice</h2>
                    <p>Dear ${username},</p>
                    <p>This email is to inform you that your Metflix account has been permanently deleted by an administrator.</p>
                    <p style="color: #e50914; font-weight: bold;">Important Information:</p>
                    <ul style="list-style-type: none; padding-left: 0;">
                        <li style="margin-bottom: 10px;">✓ Your account has been permanently removed</li>
                        <li style="margin-bottom: 10px;">✓ All your data has been deleted</li>
                        <li style="margin-bottom: 10px;">✓ Your reviews and watchlist have been removed</li>
                        <li style="margin-bottom: 10px;">✓ Any pending movie requests have been cancelled</li>
                    </ul>
                    <p>If you believe this was done in error, please contact our support team immediately.</p>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e50914;">
                        <p style="color: #666;">Best regards,</p>
                        <p style="color: #e50914; font-weight: bold;">The Metflix Team</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Account deletion email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending account deletion email:', error);
        throw error;
    }
}

module.exports = {
    sendMovieRequestApprovalEmail,
    sendMovieRequestRejectionEmail,
    sendWelcomeEmail,
    sendAccountDeletionEmail
};
