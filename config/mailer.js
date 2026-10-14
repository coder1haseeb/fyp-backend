const nodemailer = require('nodemailer');
require('dotenv').config();

const sender = process.env.EMAIL_USER;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: Number(process.env.EMAIL_PORT || 587) === 465,
  auth: {
    user: sender,
    pass: process.env.EMAIL_PASS,
  },
});

const sendMail = async (to, subject, html) => {
  try {
    const result = await transporter.sendMail({
      from: `LocalBiz <${sender}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
    return result;
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw error;
  }
};

module.exports = {
  transporter,
  sendMail,
};
