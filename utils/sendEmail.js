const { sendMail } = require('../config/mailer');

const sendOTPEmail = async (email, otp, type) => {
  let subject = '';
  let html = '';

  if (type === 'verify') {
    subject = 'Verify Your LocalBiz Email Address';
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to LocalBiz!</h2>
        <p>Please verify your email address using the OTP below:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h1 style="color: #007bff; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This OTP is valid for 10 minutes only.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">© LocalBiz. All rights reserved.</p>
      </div>
    `;
  } else if (type === 'reset') {
    subject = 'Reset Your LocalBiz Password';
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Use the OTP below to reset your password:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h1 style="color: #dc3545; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This OTP is valid for 10 minutes only.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">© LocalBiz. All rights reserved.</p>
      </div>
    `;
  }

  try {
    await sendMail(email, subject, html);
    console.log(`✅ OTP email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send OTP email:', error);
    throw error;
  }
};

module.exports = sendOTPEmail;
