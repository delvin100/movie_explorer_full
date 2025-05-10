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
                <h1>Your Movie Request is Approved!</h1>
                <p>Hello,</p>
                <p>Your request for <strong>${movieName}</strong> has been approved. You can now download the movie using the link below:</p>
                <p><a href="${downloadLink}" style="display: inline-block; padding: 10px 20px; background-color: #ff0000; color: white; text-decoration: none; border-radius: 5px;">Download Movie</a></p>
                <p>Enjoy your movie!</p>
                <p>Best regards,<br>Metflix Team</p>
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

module.exports = {
    sendMovieRequestApprovalEmail
};
